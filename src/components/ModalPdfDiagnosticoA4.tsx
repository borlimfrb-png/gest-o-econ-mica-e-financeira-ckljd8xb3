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
  Bot,
  Sparkles,
  Download,
  Copy,
  Check,
  Activity,
  Flame,
  Coins,
  TrendingUp,
  Scale,
  ShieldCheck,
  Layers,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Link } from 'react-router-dom'
import type { EmpresaRecord, MinhaEmpresaRecord, BalancoRecord, DreRecord } from '@/types/finance'
import {
  formatCurrency,
  formatPercent,
  formatCnpj,
  formatNumber,
  formatBrlMil,
  calcularBalanco,
  calcularDre,
  calcularIndicadores,
  calcularKanitz,
  calcularCapitalGiro,
  type KanitzResultado,
} from '@/lib/financeCalculations'
import type { DisplayMessage, AgentCitation } from '@/lib/skipAi'

export interface ModalPdfDiagnosticoA4Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedEmpresa: EmpresaRecord | null
  selectedAno: number
  anoComparacao?: number | null
  minhaEmpresa: MinhaEmpresaRecord | null
  logoUrl: string | null
  diagnosticoTexto: string
  tituloDiagnostico?: string
  dataGeracao?: string
  citations?: AgentCitation[]
  balancoAno?: BalancoRecord | null
  dreAno?: DreRecord | null
  balancoComp?: BalancoRecord | null
  dreComp?: DreRecord | null
  todasMensagens?: DisplayMessage[]
}

export function ModalPdfDiagnosticoA4({
  open,
  onOpenChange,
  selectedEmpresa,
  selectedAno,
  anoComparacao,
  minhaEmpresa,
  logoUrl,
  diagnosticoTexto,
  tituloDiagnostico = 'Laudo de Diagnóstico & Estratégia Financeira',
  dataGeracao,
  citations,
  balancoAno,
  dreAno,
  balancoComp,
  dreComp,
}: ModalPdfDiagnosticoA4Props) {
  const { toast } = useToast()

  const dataEmissao = useMemo(() => {
    if (dataGeracao) {
      try {
        return new Date(dataGeracao).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      } catch {
        /* intentionally ignored */
      }
    }
    return new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }, [dataGeracao])

  // Cálculos do ano principal
  const balancoCalc = useMemo(() => calcularBalanco(balancoAno), [balancoAno])
  const dreCalc = useMemo(() => calcularDre(dreAno), [dreAno])
  const indCalc = useMemo(() => calcularIndicadores(balancoAno, dreAno), [balancoAno, dreAno])
  const fleurietCalc = useMemo(() => calcularCapitalGiro(balancoAno, dreAno), [balancoAno, dreAno])
  const kanitzCalc: KanitzResultado = useMemo(
    () => calcularKanitz(balancoAno || null, dreAno || null),
    [balancoAno, dreAno],
  )

  // Cálculos do ano de comparação se houver
  const indComp = useMemo(
    () =>
      anoComparacao && (balancoComp || dreComp) ? calcularIndicadores(balancoComp, dreComp) : null,
    [anoComparacao, balancoComp, dreComp],
  )

  const hasMinhaEmpresa = !!(
    minhaEmpresa?.razao_social ||
    minhaEmpresa?.nome_fantasia ||
    minhaEmpresa?.contador_nome
  )

  const handlePrint = () => {
    window.print()
  }

  const handleCopyText = () => {
    navigator.clipboard.writeText(diagnosticoTexto)
    toast({
      title: 'Diagnóstico Copiado',
      description: 'O texto integral do laudo contábil foi copiado para a área de transferência.',
    })
  }

  const handleExportTxt = () => {
    const cabecalho = `========================================================================\nLAUDO DE DIAGNÓSTICO FINANCEIRO & ESTRATÉGICO\nConsultoria: ${minhaEmpresa?.razao_social || minhaEmpresa?.nome_fantasia || 'Consultoria Financeira'}\nEmpresa Analisada: ${selectedEmpresa?.nome || '—'} (CNPJ: ${selectedEmpresa?.cnpj ? formatCnpj(selectedEmpresa.cnpj) : '—'})\nExercício-Base: ${selectedAno}${anoComparacao ? ` vs ${anoComparacao}` : ''}\nData de Emissão: ${dataEmissao}\n========================================================================\n\n`

    const conteudoCompleto =
      cabecalho +
      diagnosticoTexto +
      `\n\n------------------------------------------------------------------------\nResponsável Técnico:\n${minhaEmpresa?.contador_nome || 'Consultor / Contador Responsável'}\nCRC: ${minhaEmpresa?.contador_crc ? `CRC ${minhaEmpresa.contador_crc}${minhaEmpresa.contador_uf_crc ? `/${minhaEmpresa.contador_uf_crc}` : ''}` : 'CRC Ativo'}\n`

    const blob = new Blob([conteudoCompleto], { type: 'text/plain;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `Laudo_Diagnostico_${(selectedEmpresa?.nome || 'Empresa').replace(/\s+/g, '_')}_${selectedAno}.txt`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 gap-0 bg-slate-100/90 border-slate-300">
        {/* Barra superior de Ações no Modal (oculta na impressão) */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0B1F3A] text-white flex items-center justify-center">
              <Bot className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-[#0B1F3A]">
                Laudo do Diagnóstico Financeiro (Padrão A4)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Laudo formal completo gerado pelo Agente de IA para exportação ou impressão
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyText}
              className="h-8 text-xs font-semibold gap-1 text-slate-700 hover:bg-slate-100"
              title="Copiar texto do laudo"
            >
              <Copy className="w-3.5 h-3.5" />
              Copiar Texto
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportTxt}
              className="h-8 text-xs font-semibold gap-1 text-slate-700 hover:bg-slate-100"
              title="Baixar arquivo de texto"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar .TXT
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
              className="h-8 text-xs font-bold bg-[#0B1F3A] hover:bg-blue-900 text-white gap-1.5 shadow-xs"
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
                  contador responsável (CRC) podem ser configurados para constar no cabeçalho e
                  assinatura do laudo.
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
            id="diagnostico-a4-document"
            className="w-full max-w-[800px] bg-white border border-slate-300 rounded-xl shadow-lg p-8 sm:p-12 text-slate-800 text-xs leading-relaxed space-y-6 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:bg-white font-sans"
          >
            {/* ========================================================= */}
            {/* CABEÇALHO FORMAL DO LAUDO (MINHA EMPRESA + EMPRESA CLIENTE) */}
            {/* ========================================================= */}
            <header className="border-b-2 border-[#0B1F3A] pb-5 space-y-4">
              {/* Topo: Logotipo e Dados da Consultoria Emissora */}
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
                        'Consultoria Econômico-Financeira & Controladoria'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {minhaEmpresa?.cnpj
                        ? `CNPJ: ${formatCnpj(minhaEmpresa.cnpj)}`
                        : 'Serviços Especializados de Diagnóstico Contábil e Estratégia Financeira'}
                    </p>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700 block">Data do Diagnóstico</span>
                  <span>{dataEmissao}</span>
                </div>
              </div>

              {/* Título Principal */}
              <div className="text-center py-2 space-y-1">
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-800 border-blue-200 text-[10px] font-bold px-3 py-0.5 uppercase tracking-wider"
                >
                  Laudo Técnico Pericial &amp; Parecer de Controladoria
                </Badge>
                <h1 className="text-xl sm:text-2xl font-black text-[#0B1F3A] tracking-tight uppercase">
                  {tituloDiagnostico}
                </h1>
                <p className="text-[11px] text-slate-500 max-w-lg mx-auto">
                  Avaliação integral de Balanço Patrimonial, DRE, Liquidez, Modelo Fleuriet,
                  Termômetro de Kanitz e Plano de Ação
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
                    <span className="text-slate-500 font-semibold">Segmento / Regime:</span>
                    <span className="text-slate-800 font-medium">
                      {selectedEmpresa?.segmento || 'Geral'}
                      {selectedEmpresa?.regime_tributario
                        ? ` (${selectedEmpresa.regime_tributario})`
                        : ''}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 sm:border-l sm:border-slate-200 sm:pl-3">
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Exercício de Referência:</span>
                    <strong className="text-blue-700 font-bold">
                      {selectedAno}
                      {anoComparacao ? ` (Comparado a ${anoComparacao})` : ''}
                    </strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Motor de Inteligência:</span>
                    <span className="text-blue-800 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-blue-600" />
                      Skip Cloud Financial Agent
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Responsável Técnico:</span>
                    <span className="text-slate-800 font-medium">
                      {minhaEmpresa?.contador_nome || 'Consultor Financeiro'}
                    </span>
                  </div>
                </div>
              </div>
            </header>

            {/* ========================================================= */}
            {/* MINI-PAINEL DE KPIS SINTÉTICOS DO EXERCÍCIO */}
            {/* ========================================================= */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <div className="p-2 rounded-lg bg-white border border-slate-200 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                  Receita Líquida
                </span>
                <strong className="text-xs font-black text-slate-900 block font-mono">
                  {formatBrlMil(dreCalc.receitaLiquida)}
                </strong>
                {anoComparacao && indComp && (
                  <span className="text-[9px] text-slate-400">vs {anoComparacao}</span>
                )}
              </div>

              <div className="p-2 rounded-lg bg-white border border-slate-200 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                  Lucro / Margem
                </span>
                <div className="flex items-baseline gap-1">
                  <strong
                    className={`text-xs font-black font-mono ${dreCalc.lucroLiquido >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}
                  >
                    {formatBrlMil(dreCalc.lucroLiquido)}
                  </strong>
                  <span className="text-[9px] text-slate-500 font-semibold">
                    ({formatPercent(indCalc.margemLiquida, 1)})
                  </span>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-white border border-slate-200 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                  Liquidez Corrente
                </span>
                <strong className="text-xs font-black text-blue-700 block font-mono">
                  {indCalc.liquidezCorrente !== null
                    ? `${formatNumber(indCalc.liquidezCorrente, 2)}x`
                    : '—'}
                </strong>
              </div>

              <div className="p-2 rounded-lg bg-white border border-slate-200 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                  Kanitz (FI)
                </span>
                <strong
                  className={`text-xs font-black block font-mono ${
                    kanitzCalc.corStatus === 'verde'
                      ? 'text-emerald-700'
                      : kanitzCalc.corStatus === 'vermelho'
                        ? 'text-rose-600'
                        : 'text-amber-600'
                  }`}
                >
                  {kanitzCalc.fi !== null
                    ? `${formatNumber(kanitzCalc.fi, 2)} (${kanitzCalc.classificacao.toUpperCase()})`
                    : '—'}
                </strong>
              </div>
            </section>

            {/* ========================================================= */}
            {/* CORPO PRINCIPAL: DIAGNÓSTICO ESTRUTURADO DO AGENTE */}
            {/* ========================================================= */}
            <section className="space-y-4">
              <div className="border-b border-slate-200 pb-1.5 flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                    1
                  </span>
                  Diagnóstico Técnico &amp; Parecer de Desempenho
                </h2>
                <Badge
                  variant="outline"
                  className="text-[10px] font-semibold bg-slate-50 text-slate-600"
                >
                  Exercício {selectedAno}
                </Badge>
              </div>

              {/* Texto do Diagnóstico Formatado */}
              <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-200 text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans space-y-3">
                {diagnosticoTexto}
              </div>

              {/* Citações e Fontes consultadas */}
              {citations && citations.length > 0 && (
                <div className="p-3 bg-white rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1.5">
                  <strong className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                    Fontes de Dados &amp; Metodologias Referenciadas:
                  </strong>
                  <div className="flex flex-wrap gap-1.5">
                    {citations.map((c, idx) => (
                      <span
                        key={idx}
                        className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-slate-700"
                      >
                        [{c.n}] {c.excerpt}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* ========================================================= */}
            {/* ENCERRAMENTO E ASSINATURA TÉCNICA */}
            {/* ========================================================= */}
            <footer className="pt-8 space-y-6 border-t border-slate-200">
              <div className="text-[11px] text-slate-500 text-justify leading-relaxed">
                <p>
                  <strong>Ressalva Metodológica:</strong> O presente diagnóstico foi elaborado a
                  partir dos dados informados e consolidados nas demonstrações contábeis (Balanço
                  Patrimonial e DRE), obedecendo às melhores práticas de análise
                  econômico-financeira, modelos preditivos de solvência (Stephen Kanitz) e dinâmica
                  de capital de giro (Michel Fleuriet).
                </p>
              </div>

              <div className="pt-4 flex flex-col items-center justify-center text-center space-y-1">
                <div className="w-64 border-t border-slate-400 pt-2 font-bold text-slate-800 text-xs">
                  {minhaEmpresa?.contador_nome || 'Consultor / Contador Responsável'}
                </div>
                <p className="text-[11px] text-slate-600">
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
            </footer>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
