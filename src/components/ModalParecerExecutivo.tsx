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
  Info,
  ExternalLink,
  Scale,
  DollarSign,
  TrendingUp,
  Percent,
  Layers,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { EmpresaRecord, MinhaEmpresaRecord } from '@/types/finance'
import type { AnaliseTributariaResultado } from '@/lib/taxCalculations'
import { formatCurrency, formatPercent, formatCnpj } from '@/lib/financeCalculations'

interface ModalParecerExecutivoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedEmpresa: EmpresaRecord | null
  selectedAno: number
  receitaBruta: number
  lucroLiquido: number
  aliquotaIss: number
  analise: AnaliseTributariaResultado
  minhaEmpresa: MinhaEmpresaRecord | null
  logoUrl: string | null
}

export function ModalParecerExecutivo({
  open,
  onOpenChange,
  selectedEmpresa,
  selectedAno,
  receitaBruta,
  lucroLiquido,
  aliquotaIss,
  analise,
  minhaEmpresa,
  logoUrl,
}: ModalParecerExecutivoProps) {
  const handlePrint = () => {
    window.print()
  }

  const margemLiquida = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 gap-0 bg-slate-100/90 border-slate-300">
        {/* Barra superior de Ações no Modal (oculta na impressão) */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-[#0B1F3A]">
                Pré-visualização do Parecer Executivo
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Documento formal em padrão A4 para apresentação ao cliente
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
            id="parecer-executivo-document"
            className="w-full max-w-[800px] bg-white border border-slate-300 rounded-xl shadow-lg p-8 sm:p-12 text-slate-800 text-xs leading-relaxed space-y-8 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:bg-white"
          >
            {/* ========================================================= */}
            {/* CAPA / CABEÇALHO FORMAL DO PARECER TRIBUTÁRIO */}
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
                        'Consultoria & Planejamento Tributário'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {minhaEmpresa?.cnpj
                        ? `CNPJ: ${formatCnpj(minhaEmpresa.cnpj)}`
                        : 'Serviços Especializados de Gestão Fiscal'}
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
                  Relatório Técnico de Planejamento Fiscal
                </Badge>
                <h1 className="text-2xl sm:text-3xl font-black text-[#0B1F3A] tracking-tight uppercase">
                  PARECER TRIBUTÁRIO
                </h1>
                <p className="text-xs text-slate-500 max-w-lg mx-auto">
                  Estudo comparativo de enquadramento tributário com base nos demonstrativos
                  contábeis (DRE e Balanço Patrimonial)
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
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Segmento / Atividade:</span>
                    <span className="text-slate-800">
                      {selectedEmpresa?.segmento || 'Serviços'}
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
                      {minhaEmpresa?.contador_nome || 'Consultor Tributário'}
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

            {/* ========================================================= */}
            {/* SUMÁRIO / ÍNDICE DE NAVEGAÇÃO */}
            {/* ========================================================= */}
            <section className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-2.5 print:hidden">
              <h3 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                Sumário Executivo do Parecer
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => scrollToSection('sec-1-objetivo')}
                  className="text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-blue-800 font-medium transition-colors flex items-center justify-between"
                >
                  <span>1. Objetivo e Escopo</span>
                  <span className="text-[10px] text-slate-400">Ir &darr;</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('sec-2-metodologia')}
                  className="text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-blue-800 font-medium transition-colors flex items-center justify-between"
                >
                  <span>2. Metodologia Aplicada</span>
                  <span className="text-[10px] text-slate-400">Ir &darr;</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('sec-3-dados')}
                  className="text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-blue-800 font-medium transition-colors flex items-center justify-between"
                >
                  <span>3. Dados Financeiros da Empresa</span>
                  <span className="text-[10px] text-slate-400">Ir &darr;</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('sec-4-resultados')}
                  className="text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-blue-800 font-medium transition-colors flex items-center justify-between"
                >
                  <span>4. Resultados por Regime</span>
                  <span className="text-[10px] text-slate-400">Ir &darr;</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('sec-5-conclusao')}
                  className="text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-blue-800 font-medium transition-colors flex items-center justify-between"
                >
                  <span>5. Conclusão e Recomendação</span>
                  <span className="text-[10px] text-slate-400">Ir &darr;</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('sec-6-reforma')}
                  className="text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-blue-800 font-medium transition-colors flex items-center justify-between"
                >
                  <span>6. Reforma Tributária (IBS / CBS)</span>
                  <span className="text-[10px] text-slate-400">Ir &darr;</span>
                </button>
              </div>
            </section>

            {/* ========================================================= */}
            {/* 1. OBJETIVO E ESCOPO */}
            {/* ========================================================= */}
            <section id="sec-1-objetivo" className="space-y-2 pt-2">
              <h2 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  1
                </span>
                Objetivo e Escopo
              </h2>
              <p className="text-slate-600 text-xs leading-relaxed text-justify">
                O presente <strong>Parecer Tributário</strong> tem como finalidade primordial
                analisar a estrutura de faturamento, custos e lucratividade de{' '}
                <strong>{selectedEmpresa?.nome || 'a empresa'}</strong> (CNPJ:{' '}
                {selectedEmpresa?.cnpj ? formatCnpj(selectedEmpresa.cnpj) : '—'}), referente ao
                exercício fiscal de <strong>{selectedAno}</strong>, visando determinar o regime de
                tributação que proporciona a maior eficiência fiscal e o menor dispêndio financeiro
                em conformidade estrita com a legislação tributária brasileira em vigor.
              </p>
              <p className="text-slate-600 text-xs leading-relaxed text-justify">
                A análise contempla a apuração dos tributos federais e municipais incidentes sobre a
                atividade econômica, avaliando as modalidades de apuração pelo{' '}
                <strong>Simples Nacional (Anexo III)</strong>, <strong>Lucro Presumido</strong> e{' '}
                <strong>Lucro Real</strong>, quantificando alíquotas efetivas, valores anuais e
                economias potenciais.
              </p>
            </section>

            {/* ========================================================= */}
            {/* 2. METODOLOGIA */}
            {/* ========================================================= */}
            <section id="sec-2-metodologia" className="space-y-3">
              <h2 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  2
                </span>
                Metodologia Aplicada
              </h2>
              <p className="text-slate-600 text-xs leading-relaxed text-justify">
                Os cálculos foram elaborados mediante aplicação dos seguintes parâmetros normativos
                e fiscais:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <strong className="text-slate-900 block font-bold">
                    Simples Nacional (LC 123/06)
                  </strong>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Aplicação da tabela do Anexo III para serviços, apurando a alíquota efetiva
                    progressiva com base na Receita Bruta Acumulada dos últimos 12 meses (RBT12) e
                    dedução de parcela da faixa legal (teto de R$ 4,8 milhões/ano).
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <strong className="text-slate-900 block font-bold">Lucro Presumido</strong>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Presunção de 32% sobre a receita bruta de serviços para apuração de IRPJ (15% +
                    adicional de 10% sobre excedente anual de R$ 240 mil) e CSLL (9%), acrescido de
                    PIS (0,65%), COFINS (3,00%) e ISS ({aliquotaIss.toFixed(1)}%).
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <strong className="text-slate-900 block font-bold">Lucro Real</strong>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Tributação com base no lucro contábil apurado (IRPJ 15% + 10% adicional e CSLL
                    9%), associado à sistemática não-cumulativa de PIS (1,65%) e COFINS (7,60%) e
                    ISS municipal ({aliquotaIss.toFixed(1)}%).
                  </p>
                </div>
              </div>
            </section>

            {/* ========================================================= */}
            {/* 3. DADOS DA EMPRESA (BALANÇO E DRE) */}
            {/* ========================================================= */}
            <section id="sec-3-dados" className="space-y-3">
              <h2 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  3
                </span>
                Dados Financeiros da Empresa (Exercício {selectedAno})
              </h2>
              <p className="text-slate-600 text-xs leading-relaxed">
                As bases de apuração foram extraídas diretamente da Demonstração do Resultado do
                Exercício (DRE) e do Balanço Patrimonial da empresa:
              </p>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-slate-800 border-b border-slate-300">
                      <th className="py-2 px-3">Rubrica Financeira / Contábil</th>
                      <th className="py-2 px-3 text-right">Valor Apurado (R$)</th>
                      <th className="py-2 px-3 text-right">% s/ Receita Bruta</th>
                      <th className="py-2 px-3">Observação Técnica</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        Receita Operacional Bruta
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        {formatCurrency(receitaBruta)}
                      </td>
                      <td className="py-2 px-3 text-right">100,0%</td>
                      <td className="py-2 px-3 text-slate-500">
                        Base de cálculo dos tributos sobre faturamento
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        Lucro Líquido do Exercício
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-bold ${
                          lucroLiquido >= 0 ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(lucroLiquido)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold">
                        {formatPercent(margemLiquida, 1)}
                      </td>
                      <td className="py-2 px-3 text-slate-500">
                        Base principal para IRPJ/CSLL no Lucro Real
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        Folha de Pagamento Estimada
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-900">
                        {formatCurrency(analise.folhaPagamento)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {receitaBruta > 0
                          ? formatPercent((analise.folhaPagamento / receitaBruta) * 100, 1)
                          : '—'}
                      </td>
                      <td className="py-2 px-3 text-slate-500">
                        Impacto previdenciário e enquadramento do Fator R
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        Alíquota de ISS Municipal
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-900">
                        {aliquotaIss.toFixed(2)}%
                      </td>
                      <td className="py-2 px-3 text-right">—</td>
                      <td className="py-2 px-3 text-slate-500">
                        Alíquota praticada no município sede
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* ========================================================= */}
            {/* 4. RESULTADOS POR REGIME */}
            {/* ========================================================= */}
            <section id="sec-4-resultados" className="space-y-3">
              <h2 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  4
                </span>
                Resultados por Regime Tributário
              </h2>
              <p className="text-slate-600 text-xs leading-relaxed">
                Quadro consolidado de tributação anual estimada comparando as três alternativas
                legais:
              </p>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-slate-800 border-b border-slate-300">
                      <th className="py-2 px-3">Regime Tributário</th>
                      <th className="py-2 px-3 text-right">Base de Cálculo Principal</th>
                      <th className="py-2 px-3 text-right">Alíquota Efetiva</th>
                      <th className="py-2 px-3 text-right">Imposto Anual Estimado</th>
                      <th className="py-2 px-3 text-right">Economia vs Pior Regime</th>
                      <th className="py-2 px-3 text-center">Classificação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {[analise.regimes.simples, analise.regimes.presumido, analise.regimes.real].map(
                      (reg) => {
                        const isRec = reg.isRecomendado
                        return (
                          <tr
                            key={reg.id}
                            className={`border-b ${
                              isRec ? 'bg-emerald-50/70 font-semibold' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-900 block">{reg.nome}</span>
                              <span className="text-[10px] text-slate-500">{reg.descricao}</span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium text-slate-800">
                              {formatCurrency(reg.baseCalculoPrincipal)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                              {formatPercent(reg.aliquotaEfetiva, 2)}
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right font-extrabold ${
                                isRec ? 'text-emerald-700 text-sm' : 'text-slate-900'
                              }`}
                            >
                              {formatCurrency(reg.impostoTotal)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-emerald-800 font-bold">
                              {reg.economiaVsPior > 0
                                ? formatCurrency(reg.economiaVsPior)
                                : 'R$ 0,00'}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {isRec ? (
                                <Badge className="bg-emerald-600 text-white font-bold text-[10px] uppercase">
                                  🏆 RECOMENDADO
                                </Badge>
                              ) : (
                                <span className="text-slate-400 text-[11px]">Alternativo</span>
                              )}
                            </td>
                          </tr>
                        )
                      },
                    )}
                  </tbody>
                </table>
              </div>

              {/* Detalhamento dos Tributos por Regime */}
              <div className="pt-2 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Detalhamento da Composição dos Tributos:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                  {[analise.regimes.simples, analise.regimes.presumido, analise.regimes.real].map(
                    (reg) => (
                      <div
                        key={reg.id}
                        className={`p-3 rounded-lg border ${
                          reg.isRecomendado
                            ? 'bg-emerald-50/40 border-emerald-300'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="font-bold text-slate-900 mb-2 border-b pb-1 flex items-center justify-between">
                          <span>{reg.nome}</span>
                          <span className="text-slate-600">{formatCurrency(reg.impostoTotal)}</span>
                        </div>
                        <div className="space-y-1">
                          {reg.breakdown.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-slate-600">
                              <span className="truncate pr-1">{item.sigla}:</span>
                              <strong className="text-slate-800 shrink-0">
                                {formatCurrency(item.valor)}
                              </strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </section>

            {/* ========================================================= */}
            {/* 5. CONCLUSÃO E RECOMENDAÇÃO TÉCNICA */}
            {/* ========================================================= */}
            <section id="sec-5-conclusao" className="space-y-3">
              <h2 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  5
                </span>
                Conclusão e Recomendação Técnica
              </h2>

              <div className="p-4 rounded-xl bg-emerald-50 border-2 border-emerald-400 text-emerald-950 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wide text-emerald-900">
                  <Award className="w-4 h-4 text-emerald-700" />
                  Opção Tributária Recomendada: {analise.regimeRecomendado?.nome}
                </div>
                <p className="text-xs leading-relaxed text-justify">
                  Com fundamento nos dados contábeis apresentados para o exercício de{' '}
                  <strong>{selectedAno}</strong>, concluímos e recomendamos que a empresa{' '}
                  <strong>{selectedEmpresa?.nome}</strong> opte formalmente pelo regime de{' '}
                  <strong className="text-emerald-900">{analise.regimeRecomendado?.nome}</strong>.
                </p>
                <p className="text-xs leading-relaxed text-justify">
                  Esta opção resultará em uma alíquota efetiva global de{' '}
                  <strong>{formatPercent(analise.regimeRecomendado?.aliquotaEfetiva, 2)}</strong>{' '}
                  sobre a receita operacional bruta, com carga tributária anual total de{' '}
                  <strong>{formatCurrency(analise.regimeRecomendado?.impostoTotal)}</strong>. Esta
                  decisão assegura uma economia fiscal líquida estimada em{' '}
                  <strong className="text-emerald-900 underline">
                    {formatCurrency(analise.economiaMaximaAnual)}
                  </strong>{' '}
                  ao ano quando comparada ao regime mais gravoso ({analise.maiorCustoRegime?.nome}),
                  maximizando a rentabilidade e o fluxo de caixa da sociedade empresária.
                </p>
              </div>
            </section>

            {/* ========================================================= */}
            {/* 6. CONSIDERAÇÕES SOBRE A REFORMA TRIBUTÁRIA */}
            {/* ========================================================= */}
            <section id="sec-6-reforma" className="space-y-3">
              <h2 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  6
                </span>
                Considerações sobre a Reforma Tributária (Emenda Constitucional 132/2023)
              </h2>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 space-y-2 text-xs leading-relaxed text-justify">
                <p>
                  A Emenda Constitucional nº 132/2023 instituiu o Imposto sobre Bens e Serviços (
                  <strong>IBS</strong>, de competência estadual e municipal) e a Contribuição sobre
                  Bens e Serviços (<strong>CBS</strong>, de competência federal), com período de
                  transição escalonado entre os anos de <strong>2026 e 2033</strong>.
                </p>
                <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-600">
                  <li>
                    <strong>Setor de Serviços:</strong> A extinção de PIS/COFINS e ISS e a transição
                    para o IBS/CBS com alíquota padrão estimada entre 26,5% e 28% exigirá atenção
                    redobrada nas empresas prestadoras de serviços sem volumosa cadeia de créditos
                    físicos.
                  </li>
                  <li>
                    <strong>Simples Nacional:</strong> O regime simplificado foi mantido
                    constitucionalmente, facultando às empresas a opção de recolher IBS/CBS pelo
                    regime geral para viabilizar transferência integral de créditos a clientes PJ.
                  </li>
                  <li>
                    <strong>Planejamento Dinâmico:</strong> Recomenda-se a revisão periódica deste
                    diagnóstico tributário anualmente nos meses de novembro e dezembro para
                    antecipação aos impactos de cada etapa de transição da reforma.
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
                      {minhaEmpresa?.contador_nome || 'Consultor Técnico Tributário'}
                    </p>
                    <p className="text-slate-500 text-[11px]">
                      {minhaEmpresa?.contador_crc
                        ? `CRC ${minhaEmpresa.contador_crc}${minhaEmpresa.contador_uf_crc ? `/${minhaEmpresa.contador_uf_crc}` : ''}`
                        : 'Responsável Técnico / Contábil'}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {minhaEmpresa?.razao_social || minhaEmpresa?.nome_fantasia || 'Consultoria'}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="border-t border-slate-700 pt-2 w-64 mx-auto">
                    <p className="font-bold text-slate-900">
                      {selectedEmpresa?.nome || 'Empresa Cliente'}
                    </p>
                    <p className="text-slate-500 text-[11px]">Representante Legal</p>
                    <p className="text-[10px] text-slate-400">
                      CNPJ: {selectedEmpresa?.cnpj ? formatCnpj(selectedEmpresa.cnpj) : '—'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-400 pt-2">
                Documento emitido eletronicamente em {dataEmissao} · Análise de Balanço &
                Planejamento Tributário
              </div>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
