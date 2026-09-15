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
  Percent,
  TrendingUp,
  Scale,
  Award,
  Building2,
  CheckCircle2,
  AlertCircle,
  Activity,
  Calendar,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { DocumentPrintFooter } from '@/components/DocumentPrintFooter'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import type { EmpresaRecord } from '@/types/finance'
import type {
  ComparativoRegimesPrecoItem,
  SimulacaoEnquadramentoRbt12,
} from '@/lib/taxCalculations'

interface ModalPdfImpostosProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tipo: 'comparativo_regimes' | 'enquadramento_rbt12'
  empresa: EmpresaRecord | null
  anoBase: number
  // Dados do comparativo de regimes (se tipo === 'comparativo_regimes')
  comparativoRegimes?: ComparativoRegimesPrecoItem[]
  custoBaseSimulado?: number
  margemDesejadaSimulada?: number
  despesasVariaveisSimuladas?: number
  regimeAtualConfigurado?: string
  // Dados do enquadramento RBT12 (se tipo === 'enquadramento_rbt12')
  simulacaoRbt12?: SimulacaoEnquadramentoRbt12 | null
  anexoSimples?: string
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

function formatCnpj(v?: string): string {
  if (!v) return ''
  const digits = v.replace(/\D/g, '')
  if (digits.length !== 14) return v
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export function ModalPdfImpostos({
  open,
  onOpenChange,
  tipo,
  empresa,
  anoBase,
  comparativoRegimes = [],
  custoBaseSimulado = 50,
  margemDesejadaSimulada = 30,
  despesasVariaveisSimuladas = 0,
  regimeAtualConfigurado = 'Simples Nacional',
  simulacaoRbt12,
  anexoSimples = 'Anexo I - Comércio',
}: ModalPdfImpostosProps) {
  const { minhaEmpresa, logoUrl } = useMinhaEmpresa()
  const hasMinhaEmpresa = Boolean(
    minhaEmpresa && (minhaEmpresa.razao_social || minhaEmpresa.nome_fantasia),
  )
  const documentRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    window.print()
  }

  const dataEmissao = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  // Destaques do comparativo
  const menorCargaRegime = React.useMemo(() => {
    if (!comparativoRegimes || comparativoRegimes.length === 0) return null
    return comparativoRegimes.find((r) => r.isMenorCarga) || comparativoRegimes[0]
  }, [comparativoRegimes])

  const maiorCargaRegime = React.useMemo(() => {
    if (!comparativoRegimes || comparativoRegimes.length === 0) return null
    return [...comparativoRegimes].sort(
      (a, b) => b.cargaTributariaTotal - a.cargaTributariaTotal,
    )[0]
  }, [comparativoRegimes])

  const diferencaMax = React.useMemo(() => {
    if (!maiorCargaRegime || !menorCargaRegime) return 0
    return Number(
      (maiorCargaRegime.precoVendaSugerido - menorCargaRegime.precoVendaSugerido).toFixed(2),
    )
  }, [maiorCargaRegime, menorCargaRegime])

  // Exportar CSV
  const handleExportCSV = () => {
    const nomeEmp = empresa?.razao_social || empresa?.nome || 'Empresa'
    let csv = '\uFEFF'

    if (tipo === 'comparativo_regimes') {
      csv += `PARECER TÉCNICO EXECUTIVO - COMPARATIVO DE REGIMES TRIBUTÁRIOS\n`
      csv += `Empresa Avaliada;${nomeEmp}\n`
      csv += `CNPJ;${empresa?.cnpj ? formatCnpj(empresa.cnpj) : '—'}\n`
      csv += `Ano-Base;${anoBase}\n`
      csv += `Custo Base Simulado;R$ ${custoBaseSimulado.toFixed(2)}\n`
      csv += `Margem Desejada;${margemDesejadaSimulada}%\n`
      csv += `Data de Emissão;${dataEmissao}\n\n`
      csv += `Regime;Carga Tributária (%);Fator Gross-up;Preço Sugerido (R$);Impostos no Preço (R$);Margem Líquida (R$);Markup;Veredicto\n`
      comparativoRegimes.forEach((r) => {
        csv += `${r.regime};${r.cargaTributariaTotal.toFixed(2)}%;${r.fatorPorDentro.toFixed(4)};R$ ${r.precoVendaSugerido.toFixed(2)};R$ ${r.valorImpostosPreco.toFixed(2)};R$ ${r.valorMargemPreco.toFixed(2)};${r.markupMultiplicador.toFixed(2)}x;${r.isMenorCarga ? 'MENOR CARGA (RECOMENDADO)' : r.isRegimeAtual ? 'Regime Atual' : 'Alternativo'}\n`
      })
    } else {
      csv += `PARECER TÉCNICO EXECUTIVO - SIMULAÇÃO DE ENQUADRAMENTO RBT12 (DRE)\n`
      csv += `Empresa Avaliada;${nomeEmp}\n`
      csv += `CNPJ;${empresa?.cnpj ? formatCnpj(empresa.cnpj) : '—'}\n`
      csv += `Ano-Base;${anoBase}\n`
      csv += `Data de Emissão;${dataEmissao}\n\n`
      if (simulacaoRbt12) {
        csv += `Receita Bruta Acumulada 12M (RBT12);${simulacaoRbt12.rbt12Formatado}\n`
        csv += `Período Analisado;${simulacaoRbt12.periodoDescricao}\n`
        csv += `Percentual do Teto Simples (R$ 4.8M);${simulacaoRbt12.percentualTetoSimples}%\n`
        csv += `Faixa Simples Sugerida;${simulacaoRbt12.faixaSugeridaSimples}\n`
        csv += `Alíquota Efetiva DAS;${simulacaoRbt12.aliquotaEfetivaSimples}%\n`
        csv += `Regime Recomendado;${simulacaoRbt12.regimeRecomendado}\n`
        csv += `Parecer Técnico;${simulacaoRbt12.motivoRecomendacao}\n`
      }
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute(
      'download',
      `${tipo === 'comparativo_regimes' ? 'comparativo_regimes' : 'enquadramento_rbt12'}_${nomeEmp.toLowerCase().replace(/\s+/g, '_')}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const tituloDocumento =
    tipo === 'comparativo_regimes'
      ? 'COMPARATIVO TRIBUTÁRIO DOS 3 REGIMES'
      : 'DIAGNÓSTICO FISCAL & ENQUADRAMENTO RBT12'

  const subtituloDocumento =
    tipo === 'comparativo_regimes'
      ? 'Análise comparativa da carga tributária, fator de gross-up e impacto no preço de venda (Simples Nacional, Lucro Presumido e Lucro Real).'
      : 'Apuração da Receita Bruta Acumulada 12 meses (DRE), termômetro de limites da LC 123/2006, faixa e alíquota efetiva aplicável.'

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
                {tipo === 'comparativo_regimes'
                  ? 'Laudo Executivo: Comparativo dos 3 Regimes (A4)'
                  : 'Laudo Executivo: Enquadramento Fiscal RBT12 (A4)'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Documento formal executivo com cabeçalho da consultoria pronto para apresentação ao
                cliente.
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-8 text-xs font-semibold gap-1 text-slate-700 hover:bg-slate-100"
              title="Exportar dados do laudo em formato CSV"
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
                  <strong>Atenção:</strong> Os dados da sua consultoria (logotipo, razão social e
                  CRC do contador) ainda não estão totalmente cadastrados.
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
            id="relatorio-tributario-document"
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
                      {minhaEmpresa?.nome_fantasia?.charAt(0) ||
                        minhaEmpresa?.razao_social?.charAt(0) ||
                        'C'}
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-extrabold text-[#0B1F3A]">
                      {minhaEmpresa?.razao_social ||
                        minhaEmpresa?.nome_fantasia ||
                        'Consultoria Contábil & Gestão Tributária'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {minhaEmpresa?.cnpj
                        ? `CNPJ: ${formatCnpj(minhaEmpresa.cnpj)}`
                        : 'Planejamento Tributário & Engenharia de Preços'}
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
                  Planejamento Tributário Executivo · Formação de Preço
                </Badge>
                <h1 className="text-xl sm:text-2xl font-black text-[#0B1F3A] tracking-tight uppercase">
                  {tituloDocumento}
                </h1>
                <p className="text-[11px] text-slate-500 max-w-lg mx-auto">{subtituloDocumento}</p>
              </div>

              {/* Quadro Informativo da Empresa Avaliada */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs">
                <div className="space-y-1.5">
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Empresa Avaliada:</span>
                    <strong className="text-[#0B1F3A] font-bold">
                      {empresa?.razao_social || empresa?.nome || 'Empresa Geral'}
                    </strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">CNPJ Cliente:</span>
                    <span className="font-mono text-slate-800 font-bold">
                      {empresa?.cnpj ? formatCnpj(empresa.cnpj) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Segmento / Setor:</span>
                    <span className="text-slate-800 font-medium">
                      {empresa?.segmento || 'Geral'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 sm:border-l sm:border-slate-200 sm:pl-3">
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Ano-Base da Análise:</span>
                    <span className="font-bold text-blue-700">{anoBase}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Consultor / Contador:</span>
                    <span className="text-slate-800 font-medium">
                      {minhaEmpresa?.contador_nome || 'Consultor Tributário'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Registro (CRC):</span>
                    <span className="text-slate-800 font-medium">
                      {minhaEmpresa?.contador_crc
                        ? `CRC ${minhaEmpresa.contador_crc}${minhaEmpresa.contador_uf_crc ? `/${minhaEmpresa.contador_uf_crc}` : ''}`
                        : 'Responsável Técnico'}
                    </span>
                  </div>
                </div>
              </div>
            </header>

            {/* ========================================================= */}
            {/* CONTEÚDO ESPECÍFICO DO LAUDO */}
            {/* ========================================================= */}

            {tipo === 'comparativo_regimes' ? (
              /* ========================================================= */
              /* LAUDO 1: COMPARATIVO DOS 3 REGIMES TRIBUTÁRIOS           */
              /* ========================================================= */
              <div className="space-y-6">
                {/* 1. Veredicto Executivo do Regime Mais Competitivo */}
                {menorCargaRegime && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border-2 border-emerald-500/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-emerald-600" />
                        <span className="font-extrabold text-xs uppercase tracking-wider text-emerald-950">
                          Veredicto Executivo de Competitividade Tributária
                        </span>
                      </div>
                      <Badge className="bg-emerald-600 text-white font-bold text-[10px]">
                        🏆 Menor Carga
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      O enquadramento no regime <strong>{menorCargaRegime.regime}</strong> apresenta
                      a menor carga fiscal global (
                      <strong className="text-emerald-700">
                        {menorCargaRegime.cargaTributariaTotal.toFixed(2)}%
                      </strong>
                      ), resultando em um preço de venda sugerido de{' '}
                      <strong className="text-emerald-700">
                        {formatBrl(menorCargaRegime.precoVendaSugerido)}
                      </strong>{' '}
                      para o custo base de {formatBrl(custoBaseSimulado)} e margem de{' '}
                      {margemDesejadaSimulada}%.
                    </p>
                    {diferencaMax > 0 && maiorCargaRegime && (
                      <div className="pt-1.5 border-t border-emerald-200 text-[11px] text-emerald-900 font-medium">
                        ✦ <strong>Economia Identificada:</strong> Até{' '}
                        <strong>{formatBrl(diferencaMax)} por unidade vendida</strong> em comparação
                        ao regime de maior impacto ({maiorCargaRegime.regime} com carga de{' '}
                        {maiorCargaRegime.cargaTributariaTotal.toFixed(2)}%).
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Parâmetros da Simulação */}
                <section className="space-y-2">
                  <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                      1
                    </span>
                    Parâmetros Simulados de Formação de Preço
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-[10px] text-slate-500 block">Custo Base Unitário:</span>
                      <strong className="text-slate-900 font-mono text-xs">
                        {formatBrl(custoBaseSimulado)}
                      </strong>
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-[10px] text-slate-500 block">Margem Desejada:</span>
                      <strong className="text-emerald-700 font-mono text-xs">
                        {margemDesejadaSimulada}%
                      </strong>
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-[10px] text-slate-500 block">Desp. Variáveis:</span>
                      <strong className="text-slate-900 font-mono text-xs">
                        {despesasVariaveisSimuladas}%
                      </strong>
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-[10px] text-slate-500 block">
                        Regime Vigente Atual:
                      </span>
                      <strong className="text-blue-700 text-xs">{regimeAtualConfigurado}</strong>
                    </div>
                  </div>
                </section>

                {/* 3. Tabela Comparativa Estruturada dos 3 Regimes */}
                <section className="space-y-2 pt-1">
                  <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                      2
                    </span>
                    Quadro Comparativo dos 3 Regimes Tributários Lado a Lado
                  </h2>

                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                          <th className="py-2.5 px-3">Regime Tributário</th>
                          <th className="py-2.5 px-3 text-right">Carga Total (%)</th>
                          <th className="py-2.5 px-3 text-right">Fator Gross-up</th>
                          <th className="py-2.5 px-3 text-right">Preço Sugerido (R$)</th>
                          <th className="py-2.5 px-3 text-right">Tributos no Preço (R$)</th>
                          <th className="py-2.5 px-3 text-right">Margem Líquida (R$)</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {comparativoRegimes.map((item, idx) => (
                          <tr
                            key={idx}
                            className={`hover:bg-slate-50/50 ${
                              item.isMenorCarga ? 'bg-emerald-50/40 font-semibold' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">{item.regime}</div>
                              <div className="text-[10px] text-slate-500 font-normal">
                                {item.regimeDescricao}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700">
                              {item.cargaTributariaTotal.toFixed(2)}%
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                              {item.fatorPorDentro.toFixed(4)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-extrabold text-slate-900">
                              {formatBrl(item.precoVendaSugerido)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-amber-700">
                              {formatBrl(item.valorImpostosPreco)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                              {formatBrl(item.valorMargemPreco)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {item.isMenorCarga ? (
                                <Badge className="bg-emerald-600 text-white text-[9px] px-1.5 py-0">
                                  Menor Carga
                                </Badge>
                              ) : item.isRegimeAtual ? (
                                <Badge
                                  variant="outline"
                                  className="text-blue-700 border-blue-300 text-[9px] px-1.5 py-0"
                                >
                                  Vigente
                                </Badge>
                              ) : (
                                <span className="text-[10px] text-slate-400">Alternativo</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* 4. Detalhamento dos Tributos por Regime */}
                <section className="space-y-2 pt-1">
                  <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                      3
                    </span>
                    Discriminação das Alíquotas Incidentes por Regime
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    {comparativoRegimes.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                          <span className="font-bold text-slate-900">{item.regime}</span>
                          <span className="font-bold text-amber-700 text-[11px] font-mono">
                            {item.cargaTributariaTotal.toFixed(2)}%
                          </span>
                        </div>
                        <div className="space-y-1 pt-0.5">
                          {item.detalhesTributos.map((trib, tIdx) => (
                            <div
                              key={tIdx}
                              className="flex justify-between text-[10px] text-slate-600"
                            >
                              <span>{trib.nome}:</span>
                              <span className="font-mono text-slate-800">
                                {trib.aliquota.toFixed(2)}% ({formatBrl(trib.valorNoPreco)})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            ) : (
              /* ========================================================= */
              /* LAUDO 2: ENQUADRAMENTO FISCAL RBT12 (DRE)                */
              /* ========================================================= */
              <div className="space-y-6">
                {/* 1. Card Destaque do Faturamento RBT12 */}
                {simulacaoRbt12 && (
                  <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>RECEITA BRUTA ACUMULADA 12 MESES (RBT12 - DRE)</span>
                      <Badge
                        className={`${
                          simulacaoRbt12.isAcimaDoTetoSimples
                            ? 'bg-rose-500 text-white'
                            : simulacaoRbt12.isProximoDoTetoSimples
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-emerald-500 text-white'
                        }`}
                      >
                        {simulacaoRbt12.isAcimaDoTetoSimples
                          ? 'Estouro de Limite LC 123'
                          : simulacaoRbt12.isProximoDoTetoSimples
                            ? 'Atenção ao Sublimite'
                            : 'Dentro do Teto Geral'}
                      </Badge>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                        {simulacaoRbt12.rbt12Formatado}
                      </span>
                      <span className="text-xs text-slate-300">
                        {simulacaoRbt12.periodoDescricao}
                      </span>
                    </div>

                    {/* Termômetro de Limites */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-800">
                      <div className="flex items-center justify-between text-[11px] text-slate-300">
                        <span>Consumo do Teto Simples Nacional (R$ 4.800.000,00):</span>
                        <span className="font-bold text-white font-mono">
                          {simulacaoRbt12.percentualTetoSimples}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
                        <div
                          className={`h-full ${
                            simulacaoRbt12.isAcimaDoTetoSimples
                              ? 'bg-rose-500'
                              : simulacaoRbt12.isProximoDoTetoSimples
                                ? 'bg-amber-400'
                                : 'bg-emerald-500'
                          }`}
                          style={{
                            width: `${Math.min(100, simulacaoRbt12.percentualTetoSimples)}%`,
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>R$ 0,00</span>
                        <span>Sublimite Estadual ICMS/ISS: R$ 3,60M</span>
                        <span>Teto Nacional: R$ 4,80M</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Diagnóstico e Recomendação de Enquadramento */}
                {simulacaoRbt12 && (
                  <section className="space-y-2">
                    <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                        1
                      </span>
                      Diagnóstico e Recomendação Técnica de Enquadramento
                    </h2>

                    <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-blue-950">
                          Regime Tributário Recomendado:
                        </span>
                        <Badge className="bg-blue-700 text-white font-bold">
                          {simulacaoRbt12.regimeRecomendado}
                        </Badge>
                      </div>
                      <p className="text-slate-700 leading-relaxed text-justify">
                        {simulacaoRbt12.motivoRecomendacao}
                      </p>
                    </div>

                    {/* Dados Específicos do Simples Nacional */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-500 block">Anexo Selecionado:</span>
                        <strong className="text-slate-900 text-[11px] block truncate">
                          {anexoSimples}
                        </strong>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-500 block">
                          Faixa RBT12 Apurada:
                        </span>
                        <strong className="text-slate-900 text-[11px] block truncate">
                          {simulacaoRbt12.faixaSugeridaSimples}
                        </strong>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-500 block">Alíquota Nominal:</span>
                        <strong className="text-slate-900 font-mono text-xs">
                          {simulacaoRbt12.aliquotaNominalSimples.toFixed(2)}%
                        </strong>
                      </div>
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <span className="text-[10px] text-emerald-800 block font-semibold">
                          Alíquota Efetiva DAS:
                        </span>
                        <strong className="text-emerald-900 font-mono text-sm font-bold">
                          {simulacaoRbt12.aliquotaEfetivaSimples.toFixed(2)}%
                        </strong>
                      </div>
                    </div>
                  </section>
                )}

                {/* 3. Lista de Alertas Fiscais */}
                {simulacaoRbt12 && simulacaoRbt12.alertas.length > 0 && (
                  <section className="space-y-2 pt-1">
                    <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                        2
                      </span>
                      Pontos Críticos e Alertas de Conformidade Fiscal
                    </h2>
                    <div className="space-y-2">
                      {simulacaoRbt12.alertas.map((alerta, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                            alerta.tipo === 'danger'
                              ? 'bg-rose-50 border-rose-200 text-rose-950'
                              : alerta.tipo === 'warning'
                                ? 'bg-amber-50 border-amber-200 text-amber-950'
                                : alerta.tipo === 'success'
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                                  : 'bg-blue-50 border-blue-200 text-blue-950'
                          }`}
                        >
                          <div className="mt-0.5">
                            {alerta.tipo === 'danger' ? (
                              <AlertTriangle className="w-4 h-4 text-rose-600" />
                            ) : alerta.tipo === 'warning' ? (
                              <AlertCircle className="w-4 h-4 text-amber-600" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            )}
                          </div>
                          <div>
                            <strong className="block text-[11px] font-bold">{alerta.titulo}</strong>
                            <p className="text-[10px] mt-0.5 leading-snug">{alerta.mensagem}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* PARECER TÉCNICO & ASSINATURAS FORMAIS                    */}
            {/* ========================================================= */}
            <section className="pt-4 border-t-2 border-slate-200 space-y-6">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 leading-relaxed">
                <strong className="text-slate-800 block mb-1">Conclusão da Consultoria:</strong>
                O presente parecer foi emitido com base nos lançamentos contábeis da DRE e
                configurações vigentes de tributos. A escolha do regime e a aplicação das alíquotas
                na formação de preço devem ser validadas periodicamente frente às oscilações de
                faturamento e margens operacionais.
              </div>

              {/* Assinaturas */}
              <div className="grid grid-cols-2 gap-8 pt-4">
                <div className="text-center space-y-1">
                  <div className="border-t border-slate-400 pt-2 w-48 mx-auto" />
                  <p className="text-xs font-bold text-slate-900">
                    {minhaEmpresa?.contador_nome || 'Consultor Tributário Responsável'}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {minhaEmpresa?.contador_crc
                      ? `CRC: ${minhaEmpresa.contador_crc}${minhaEmpresa.contador_uf_crc ? `/${minhaEmpresa.contador_uf_crc}` : ''}`
                      : 'Planejamento Tributário & Controladoria'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {minhaEmpresa?.razao_social || minhaEmpresa?.nome_fantasia || 'Consultoria'}
                  </p>
                </div>

                <div className="text-center space-y-1">
                  <div className="border-t border-slate-400 pt-2 w-48 mx-auto" />
                  <p className="text-xs font-bold text-slate-900">
                    {empresa?.razao_social || empresa?.nome || 'Gestor / Representante Legal'}
                  </p>
                  <p className="text-[10px] text-slate-500">Diretoria / Gestão Financeira</p>
                  <p className="text-[10px] text-slate-400">
                    {empresa?.cnpj ? `CNPJ: ${formatCnpj(empresa.cnpj)}` : ''}
                  </p>
                </div>
              </div>
            </section>

            {/* Rodapé fixo formal na impressão */}
            <DocumentPrintFooter
              documentTitle={tituloDocumento}
              empresaNome={empresa?.razao_social || empresa?.nome}
              exercicioAno={anoBase}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
