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
  AlertTriangle,
  Award,
  ExternalLink,
  Layers,
  Coins,
  TrendingUp,
  Briefcase,
  Calculator,
  Scale,
  CheckCircle2,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { EmpresaRecord, MinhaEmpresaRecord } from '@/types/finance'
import { formatCurrency, formatPercent, formatCnpj, formatNumber } from '@/lib/financeCalculations'

export interface SensibilidadeItem {
  wacc: number
  g: number
  valor: number | null
}

export interface ModalLaudoValuationProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedEmpresa: EmpresaRecord | null
  selectedAno: number
  minhaEmpresa: MinhaEmpresaRecord | null
  logoUrl: string | null
  // Parâmetros FCD
  taxaWacc: number
  taxaPerpetuidade: number
  anosProjecao: number
  crescimentoAnualFcf: number
  baseFluxoCaixa: number
  nomeBaseFluxo: string
  valorEmpresaFCD: number
  somaVpFluxos: number
  vpValorTerminal: number
  valorTerminalNominal: number
  // Parâmetros Goodwill
  taxaRetornoEsperadoPL: number
  taxaCapitalizacaoGoodwill: number
  patrimonioLiquido: number
  lucroLiquido: number
  lucroNormal: number
  superlucro: number
  goodwill: number
  valorEmpresaGoodwill: number
  // Sensibilidade
  sensibilidadeGrid: {
    waccValues: number[]
    gValues: number[]
    matrix: (number | null)[][]
  }
  // Diagnóstico
  parecerConsolidado: {
    nivel: 'excelente' | 'adequado' | 'alerta' | 'critico'
    titulo: string
    diagnosticoFCD: string
    diagnosticoGoodwill: string
    comparativoTexto: string
    recomendacao: string
  } | null
}

export function ModalLaudoValuation({
  open,
  onOpenChange,
  selectedEmpresa,
  selectedAno,
  minhaEmpresa,
  logoUrl,
  taxaWacc,
  taxaPerpetuidade,
  anosProjecao,
  crescimentoAnualFcf,
  baseFluxoCaixa,
  nomeBaseFluxo,
  valorEmpresaFCD,
  somaVpFluxos,
  vpValorTerminal,
  valorTerminalNominal,
  taxaRetornoEsperadoPL,
  taxaCapitalizacaoGoodwill,
  patrimonioLiquido,
  lucroLiquido,
  lucroNormal,
  superlucro,
  goodwill,
  valorEmpresaGoodwill,
  sensibilidadeGrid,
  parecerConsolidado,
}: ModalLaudoValuationProps) {
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

  const isWaccMenorOuIgualG = taxaWacc <= taxaPerpetuidade
  const valorMedioSugerido =
    !isWaccMenorOuIgualG && valorEmpresaFCD > 0 && valorEmpresaGoodwill > 0
      ? (valorEmpresaFCD + valorEmpresaGoodwill) / 2
      : valorEmpresaFCD > 0
        ? valorEmpresaFCD
        : valorEmpresaGoodwill

  const diferencaValor = valorEmpresaFCD - valorEmpresaGoodwill
  const diferencaPercentual =
    valorEmpresaGoodwill !== 0 ? (diferencaValor / Math.abs(valorEmpresaGoodwill)) * 100 : 0

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 gap-0 bg-slate-100/90 border-slate-300">
        {/* Barra superior de Ações no Modal (oculta na impressão) */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-[#0B1F3A]">
                Laudo Técnico de Valuation
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Documento formal em padrão A4 para apresentação a sócios, investidores e bancos
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
                  <strong>Atenção:</strong> Os dados da sua consultoria/empresa e do responsável
                  técnico (CRC) ainda não estão totalmente cadastrados.
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
            id="laudo-valuation-document"
            className="w-full max-w-[800px] bg-white border border-slate-300 rounded-xl shadow-lg p-8 sm:p-12 text-slate-800 text-xs leading-relaxed space-y-8 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:bg-white"
          >
            {/* ========================================================= */}
            {/* CAPA / CABEÇALHO FORMAL DO LAUDO DE VALUATION */}
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
                      {minhaEmpresa?.nome_fantasia?.charAt(0) || 'V'}
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-extrabold text-[#0B1F3A]">
                      {minhaEmpresa?.razao_social ||
                        minhaEmpresa?.nome_fantasia ||
                        'Consultoria & Avaliação Econômica'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {minhaEmpresa?.cnpj
                        ? `CNPJ: ${formatCnpj(minhaEmpresa.cnpj)}`
                        : 'Serviços Especializados de Valuation e Finanças Corporativas'}
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
                  Relatório Técnico de Avaliação Econômico-Financeira
                </Badge>
                <h1 className="text-2xl sm:text-3xl font-black text-[#0B1F3A] tracking-tight uppercase">
                  LAUDO DE VALUATION
                </h1>
                <p className="text-xs text-slate-500 max-w-lg mx-auto">
                  Determinação do Valor Econômico da Empresa (Enterprise Value) mediante Fluxo de
                  Caixa Descontado (FCD) e Capitalização de Superlucro (Goodwill)
                </p>
              </div>

              {/* Quadro Informativo da Capa */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs">
                <div className="space-y-1.5">
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Empresa Avaliada:</span>
                    <strong className="text-[#0B1F3A]">{selectedEmpresa?.nome || '—'}</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">CNPJ:</span>
                    <span className="font-mono text-slate-800">
                      {selectedEmpresa?.cnpj ? formatCnpj(selectedEmpresa.cnpj) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Segmento / Atividade:</span>
                    <span className="text-slate-800">
                      {selectedEmpresa?.segmento || 'Não informado'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 sm:border-l sm:border-slate-200 sm:pl-3">
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Exercício-Base:</span>
                    <strong className="text-blue-700 font-bold">{selectedAno}</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Consultor Responsável:</span>
                    <span className="text-slate-800 font-medium">
                      {minhaEmpresa?.contador_nome || 'Consultor Financeiro'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">
                      Registro Profissional (CRC):
                    </span>
                    <span className="text-slate-800 font-medium">
                      {minhaEmpresa?.contador_crc
                        ? `CRC ${minhaEmpresa.contador_crc}${minhaEmpresa.contador_uf_crc ? `/${minhaEmpresa.contador_uf_crc}` : ''}`
                        : 'CRC Ativo'}
                    </span>
                  </div>
                </div>
              </div>
            </header>

            {/* Sumário de Navegação em Tela */}
            <section className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-2.5 print:hidden">
              <h3 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                Sumário do Laudo de Valuation
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => scrollToSection('sec-1-objetivo')}
                  className="text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-blue-800 font-medium transition-colors flex items-center justify-between"
                >
                  <span>1. Objetivo e Metodologia</span>
                  <span className="text-[10px] text-slate-400">Ir &darr;</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('sec-2-resultados')}
                  className="text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-blue-800 font-medium transition-colors flex items-center justify-between"
                >
                  <span>2. Resultados dos Modelos</span>
                  <span className="text-[10px] text-slate-400">Ir &darr;</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('sec-3-sensibilidade')}
                  className="text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-blue-800 font-medium transition-colors flex items-center justify-between"
                >
                  <span>3. Análise de Sensibilidade</span>
                  <span className="text-[10px] text-slate-400">Ir &darr;</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('sec-4-conclusao')}
                  className="text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-blue-800 font-medium transition-colors flex items-center justify-between"
                >
                  <span>4. Conclusão e Ressalvas</span>
                  <span className="text-[10px] text-slate-400">Ir &darr;</span>
                </button>
              </div>
            </section>

            {/* ========================================================= */}
            {/* 1. OBJETIVO E METODOLOGIA */}
            {/* ========================================================= */}
            <section id="sec-1-objetivo" className="space-y-3 pt-2">
              <h2 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  1
                </span>
                Objetivo e Metodologia
              </h2>
              <p className="text-slate-600 text-xs leading-relaxed text-justify">
                O presente <strong>Laudo de Valuation</strong> tem por finalidade técnica e
                econômica apurar o <strong>Valor da Empresa (Enterprise Value)</strong> de{' '}
                <strong>{selectedEmpresa?.nome || 'a sociedade avaliada'}</strong> (CNPJ:{' '}
                {selectedEmpresa?.cnpj ? formatCnpj(selectedEmpresa.cnpj) : '—'}), com base nas
                demonstrações contábeis e operacionais do exercício de{' '}
                <strong>{selectedAno}</strong>.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                  <strong className="text-blue-900 block font-bold flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                    Modelo A: Fluxo de Caixa Descontado (FCD / Gordon)
                  </strong>
                  <p className="text-slate-600 text-[11px] leading-relaxed text-justify">
                    Método amplamente reconhecido no mercado financeiro global. Projeta os fluxos de
                    caixa livres operacionais da empresa por um período explícito de{' '}
                    <strong>{anosProjecao} anos</strong> à taxa de crescimento anual de{' '}
                    <strong>{formatPercent(crescimentoAnualFcf, 1)}</strong>, descontados ao Custo
                    Médio Ponderado de Capital (WACC de{' '}
                    <strong>{formatPercent(taxaWacc, 1)}</strong>) e somados ao Valor Terminal
                    calculado pelo Modelo de Gordon com crescimento perpétuo (g) de{' '}
                    <strong>{formatPercent(taxaPerpetuidade, 1)}</strong>.
                  </p>
                  <div className="text-[10px] font-mono bg-blue-50 p-1.5 rounded border border-blue-100 text-blue-900">
                    Base FCF: {nomeBaseFluxo} ({formatCurrency(baseFluxoCaixa)}) · WACC: {taxaWacc}%
                    · g: {taxaPerpetuidade}%
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                  <strong className="text-emerald-900 block font-bold flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                    Modelo B: Goodwill (Capitalização do Superlucro)
                  </strong>
                  <p className="text-slate-600 text-[11px] leading-relaxed text-justify">
                    Método contábil-econômico que parte do valor patrimonial contábil (Patrimônio
                    Líquido de <strong>{formatCurrency(patrimonioLiquido)}</strong>) e soma o
                    Goodwill decorrente de lucros anormais (superlucro). O superlucro é o excedente
                    do lucro líquido frente à remuneração mínima esperada do capital próprio (
                    <strong>{formatPercent(taxaRetornoEsperadoPL, 1)} a.a.</strong>), capitalizado à
                    taxa de <strong>{formatPercent(taxaCapitalizacaoGoodwill, 1)} a.a.</strong>
                  </p>
                  <div className="text-[10px] font-mono bg-emerald-50 p-1.5 rounded border border-emerald-100 text-emerald-900">
                    PL: {formatCurrency(patrimonioLiquido)} · Retorno Esperado:{' '}
                    {taxaRetornoEsperadoPL}% · Cap: {taxaCapitalizacaoGoodwill}%
                  </div>
                </div>
              </div>
            </section>

            {/* ========================================================= */}
            {/* 2. RESULTADOS */}
            {/* ========================================================= */}
            <section id="sec-2-resultados" className="space-y-3">
              <h2 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  2
                </span>
                Resultados e Síntese da Avaliação
              </h2>

              <p className="text-slate-600 text-xs leading-relaxed">
                Tabela comparativa dos valores apurados pelos dois modelos de avaliação e valor
                médio de referência:
              </p>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-slate-800 border-b border-slate-300">
                      <th className="py-2.5 px-3">Modelo de Avaliação</th>
                      <th className="py-2.5 px-3">Premissas Centrais</th>
                      <th className="py-2.5 px-3 text-right">Valor da Empresa (R$)</th>
                      <th className="py-2.5 px-3 text-right">Diferença vs Goodwill</th>
                      <th className="py-2.5 px-3 text-center">Status Metodológico</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {/* Linha FCD */}
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-blue-900">
                        Fluxo de Caixa Descontado (FCD)
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        WACC = {taxaWacc}%, g = {taxaPerpetuidade}%, {anosProjecao} anos proj.
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-blue-700 text-sm">
                        {isWaccMenorOuIgualG ? '—' : formatCurrency(valorEmpresaFCD)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                        {isWaccMenorOuIgualG
                          ? '—'
                          : diferencaValor >= 0
                            ? `+${formatCurrency(diferencaValor)}`
                            : formatCurrency(diferencaValor)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge className="bg-blue-50 text-blue-800 border-blue-200 font-bold text-[10px]">
                          Intrínseco / Operacional
                        </Badge>
                      </td>
                    </tr>

                    {/* Linha Goodwill */}
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-emerald-900">
                        Modelo Goodwill (Superlucro)
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        Retorno PL = {taxaRetornoEsperadoPL}%, Cap = {taxaCapitalizacaoGoodwill}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-emerald-700 text-sm">
                        {formatCurrency(valorEmpresaGoodwill)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                        R$ 0,00 (0,0%)
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 font-bold text-[10px]">
                          Patrimonial / Vantagem
                        </Badge>
                      </td>
                    </tr>

                    {/* Linha Valor Médio Sugerido */}
                    <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                      <td className="py-3 px-3 text-[#0B1F3A] uppercase">
                        ⭐ Valor Médio Sugerido (Consolidado)
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-normal">
                        Média ponderada/aritmética dos métodos aplicáveis
                      </td>
                      <td className="py-3 px-3 text-right font-black text-[#0B1F3A] text-base">
                        {formatCurrency(valorMedioSugerido)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600 font-semibold">
                        {isWaccMenorOuIgualG ? '—' : `${formatPercent(diferencaPercentual / 2, 1)}`}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge className="bg-[#0B1F3A] text-white font-bold text-[10px]">
                          Faixa de Referência
                        </Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Detalhes de Composição */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-[11px]">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-800 block">
                    Composição do Valuation FCD:
                  </span>
                  <div className="flex justify-between text-slate-600">
                    <span>Soma do VP dos Fluxos ({anosProjecao} anos):</span>
                    <strong className="text-slate-800">{formatCurrency(somaVpFluxos)}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>VP do Valor Terminal (Perpetuidade):</span>
                    <strong className="text-emerald-700">
                      {isWaccMenorOuIgualG ? '—' : formatCurrency(vpValorTerminal)}
                    </strong>
                  </div>
                  <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-1">
                    <span>Valor Terminal Nominal:</span>
                    <span className="text-slate-700">{formatCurrency(valorTerminalNominal)}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-800 block">
                    Composição do Valuation Goodwill:
                  </span>
                  <div className="flex justify-between text-slate-600">
                    <span>Patrimônio Líquido (Valor Contábil):</span>
                    <strong className="text-slate-800">{formatCurrency(patrimonioLiquido)}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Superlucro Apurado:</span>
                    <strong className={superlucro >= 0 ? 'text-emerald-700' : 'text-amber-600'}>
                      {formatCurrency(superlucro)}
                    </strong>
                  </div>
                  <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-1">
                    <span>Goodwill Capitalizado:</span>
                    <strong className={goodwill >= 0 ? 'text-emerald-700' : 'text-amber-600'}>
                      {formatCurrency(goodwill)}
                    </strong>
                  </div>
                </div>
              </div>
            </section>

            {/* ========================================================= */}
            {/* 3. ANÁLISE DE SENSIBILIDADE NO FCD */}
            {/* ========================================================= */}
            <section id="sec-3-sensibilidade" className="space-y-3">
              <h2 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  3
                </span>
                Análise de Sensibilidade no FCD (WACC vs Taxa de Crescimento g)
              </h2>

              <p className="text-slate-600 text-xs leading-relaxed text-justify">
                A tabela abaixo demonstra a variação do{' '}
                <strong>Valor Total da Empresa (FCD)</strong> em diferentes cenários macroeconômicos
                e de risco de capital (WACC) e perspectivas de crescimento perpétuo (g). A célula
                delimitada reflete os parâmetros atualmente adotados no laudo. Células onde WACC ≤ g
                são matematicamente desconsideradas (—).
              </p>

              <div className="overflow-x-auto rounded-xl border border-slate-300">
                <table className="w-full text-xs text-center border-collapse">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-slate-800 border-b border-slate-300">
                      <th className="py-2 px-3 text-left bg-slate-200 text-[#0B1F3A]">
                        WACC \ g (%)
                      </th>
                      {sensibilidadeGrid.gValues.map((g) => (
                        <th
                          key={g}
                          className={`py-2 px-2 text-right ${
                            Math.abs(g - taxaPerpetuidade) < 0.01
                              ? 'bg-blue-100 text-blue-950 font-black'
                              : ''
                          }`}
                        >
                          g = {g.toFixed(1)}%
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {sensibilidadeGrid.waccValues.map((wVal, rIdx) => {
                      const isRowSelected = Math.abs(wVal - taxaWacc) < 0.01
                      return (
                        <tr key={wVal} className={isRowSelected ? 'bg-blue-50/40' : ''}>
                          <td
                            className={`py-2 px-3 text-left font-bold ${
                              isRowSelected
                                ? 'bg-blue-100/70 text-blue-900'
                                : 'bg-slate-50 text-slate-700'
                            }`}
                          >
                            WACC = {wVal.toFixed(1)}%
                          </td>
                          {sensibilidadeGrid.gValues.map((gVal, cIdx) => {
                            const val = sensibilidadeGrid.matrix[rIdx]?.[cIdx]
                            const isExactMatch =
                              Math.abs(wVal - taxaWacc) < 0.01 &&
                              Math.abs(gVal - taxaPerpetuidade) < 0.01

                            return (
                              <td
                                key={gVal}
                                className={`py-2 px-2 text-right font-mono transition-colors ${
                                  isExactMatch
                                    ? 'bg-blue-600 text-white font-extrabold shadow-inner ring-2 ring-blue-700'
                                    : val === null
                                      ? 'text-slate-400 bg-slate-50'
                                      : 'text-slate-800'
                                }`}
                              >
                                {val === null ? '—' : formatCurrency(val)}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ========================================================= */}
            {/* 4. CONCLUSÃO E RESSALVAS */}
            {/* ========================================================= */}
            <section id="sec-4-conclusao" className="space-y-3">
              <h2 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  4
                </span>
                Conclusão, Diagnóstico e Ressalvas Técnicas
              </h2>

              {parecerConsolidado && (
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-slate-800 space-y-2 text-xs leading-relaxed text-justify">
                  <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wide text-blue-950">
                    <Award className="w-4 h-4 text-blue-700" />
                    Síntese do Parecer do Avaliador: {parecerConsolidado.titulo}
                  </div>
                  <p className="text-slate-700">{parecerConsolidado.diagnosticoFCD}</p>
                  <p className="text-slate-700">{parecerConsolidado.diagnosticoGoodwill}</p>
                  {parecerConsolidado.comparativoTexto && (
                    <p className="text-slate-700">{parecerConsolidado.comparativoTexto}</p>
                  )}
                  <p className="text-blue-950 font-medium">
                    <strong>Recomendação Técnica:</strong> {parecerConsolidado.recomendacao}
                  </p>
                </div>
              )}

              {/* Ressalvas e Limitações do Estudo */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 space-y-2 text-xs leading-relaxed text-justify">
                <strong className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider">
                  Ressalvas e Limitações da Avaliação:
                </strong>
                <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-600">
                  <li>
                    <strong>Fonte de Dados:</strong> O presente laudo fundamenta-se nas informações
                    financeiras e contábeis disponibilizadas pela administração da empresa avaliada,
                    presumindo-se a veracidade e consistência dos lançamentos contábeis.
                  </li>
                  <li>
                    <strong>Premissas Futuras:</strong> As projeções de receitas e fluxos futuros
                    decorrem de premissas estimadas com base no histórico recente e em condições de
                    mercado. Alterações macroeconômicas, tributárias ou setoriais podem impactar os
                    resultados projetados.
                  </li>
                  <li>
                    <strong>Finalidade:</strong> Este documento serve como referencial técnico e não
                    constitui garantia de liquidação de ativos por valor pré-fixado, servindo de
                    norteador em negociações privadas, rodadas de investimento e tomada de decisão
                    estratégica.
                  </li>
                </ul>
              </div>
            </section>

            {/* ========================================================= */}
            {/* ASSINATURA DO CONSULTOR E CONTADOR */}
            {/* ========================================================= */}
            <section className="pt-8 border-t-2 border-slate-300 space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-center text-xs">
                <div className="space-y-1">
                  <div className="border-t border-slate-700 pt-2 w-64 mx-auto">
                    <p className="font-bold text-slate-900">
                      {minhaEmpresa?.contador_nome || 'Consultor Técnico em Valuation'}
                    </p>
                    <p className="text-slate-500 text-[11px]">
                      {minhaEmpresa?.contador_crc
                        ? `CRC ${minhaEmpresa.contador_crc}${minhaEmpresa.contador_uf_crc ? `/${minhaEmpresa.contador_uf_crc}` : ''}`
                        : 'Responsável Técnico / Avaliador Econômico'}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {minhaEmpresa?.razao_social ||
                        minhaEmpresa?.nome_fantasia ||
                        'Consultoria de Avaliação'}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="border-t border-slate-700 pt-2 w-64 mx-auto">
                    <p className="font-bold text-slate-900">
                      {selectedEmpresa?.nome || 'Empresa Avaliada'}
                    </p>
                    <p className="text-slate-500 text-[11px]">Representante Legal / Acionistas</p>
                    <p className="text-[10px] text-slate-400">
                      CNPJ: {selectedEmpresa?.cnpj ? formatCnpj(selectedEmpresa.cnpj) : '—'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-400 pt-2">
                Laudo emitido eletronicamente em {dataEmissao} · Avaliação de Empresas & Finanças
                Corporativas
              </div>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
