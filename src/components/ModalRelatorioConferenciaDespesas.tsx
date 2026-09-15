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
  CheckCircle2,
  AlertCircle,
  Building,
  Check,
  Sparkles,
  Layers,
  Calendar,
  History,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { DocumentPrintFooter } from '@/components/DocumentPrintFooter'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import type { EmpresaRecord } from '@/types/finance'
import type { DespesaExtraidaItem, DespesaGrupoResumo } from '@/lib/despesasParser'

export interface ModalRelatorioConferenciaDespesasProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresa: EmpresaRecord | null
  arquivosImportados: Array<{ name: string; size?: number; type?: string }>
  despesas: DespesaExtraidaItem[]
  gruposCategoria: DespesaGrupoResumo[]
  resumoLancamentos?: {
    totalItens: number
    totalValor: number
    novasContasCount: number
    lancamentosCount: number
    empresaNome: string
  } | null
  novasContasCriadas?: Array<{
    nome: string
    codigo?: string
    centro?: string
    tipo?: string
  }>
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

export function ModalRelatorioConferenciaDespesas({
  open,
  onOpenChange,
  empresa,
  arquivosImportados,
  despesas,
  gruposCategoria,
  resumoLancamentos,
  novasContasCriadas = [],
}: ModalRelatorioConferenciaDespesasProps) {
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

  // Métricas
  const totalGeral = despesas.reduce((acc, d) => acc + (d.valor || 0), 0)
  const cadastradas = despesas.filter((d) => d.isCadastrada)
  const naoCadastradas = despesas.filter((d) => !d.isCadastrada)
  const cadastradasValor = cadastradas.reduce((acc, d) => acc + (d.valor || 0), 0)
  const naoCadastradasValor = naoCadastradas.reduce((acc, d) => acc + (d.valor || 0), 0)
  const vindasDeMemoria = despesas.filter((d) => d.matchConfidence === 'memoria')

  // Exportar CSV de conferência
  const handleExportCSV = () => {
    const nomeEmp = empresa?.razao_social || empresa?.nome || 'Empresa'
    let csv = '\uFEFF'
    csv += `RELATÓRIO DE CONFERÊNCIA DA IMPORTAÇÃO DE DESPESAS (IA)\n`
    csv += `Empresa;${nomeEmp}\n`
    csv += `CNPJ;${empresa?.cnpj ? formatCnpj(empresa.cnpj) : '—'}\n`
    csv += `Data de Emissão;${dataEmissao}\n`
    csv += `Arquivos;${arquivosImportados.map((a) => a.name).join(', ')}\n\n`

    csv += `Data;Arquivo Origem;Descrição;Categoria Sugerida;Valor (R$);Status Plano de Contas;Código PC;Conta Contábil;Origem da Sugestão;Selecionada\n`
    despesas.forEach((d) => {
      csv += `${d.data};${d.sourceFile};"${d.descricao.replace(/"/g, '""')}";${d.categoriaSugerida};${d.valor.toFixed(2)};${d.isCadastrada ? 'Cadastrada' : 'Não Cadastrada'};${d.planoContaCodigo || ''};"${(d.planoContaNome || '').replace(/"/g, '""')}";"${d.origemSugestao || ''}";${d.selecionada ? 'Sim' : 'Não'}\n`
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute(
      'download',
      `conferencia_importacao_despesas_${nomeEmp.toLowerCase().replace(/\s+/g, '_')}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

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
                Relatório de Conferência da Importação de Despesas (A4)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Documento executivo de auditoria da leitura de despesas com cabeçalho corporativo.
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-8 text-xs font-semibold gap-1 text-slate-700 hover:bg-slate-100"
              title="Exportar planilha CSV da conferência"
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
            id="relatorio-conferencia-despesas-document"
            className="w-full max-w-[800px] bg-white border border-slate-300 rounded-xl shadow-lg p-8 sm:p-12 text-slate-800 text-xs leading-relaxed space-y-6 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:bg-white"
          >
            {/* ========================================================= */}
            {/* CABEÇALHO CORPORATIVO FORMAL (MINHA EMPRESA)             */}
            {/* ========================================================= */}
            <header className="border-b-2 border-[#0B1F3A] pb-5 space-y-4">
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
                        'Consultoria Contábil & Gestão Econômica'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {minhaEmpresa?.cnpj
                        ? `CNPJ: ${formatCnpj(minhaEmpresa.cnpj)}`
                        : 'Auditoria & Importação Inteligente de Despesas'}
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
                  Auditoria de Importação · Agente de Inteligência Artificial
                </Badge>
                <h1 className="text-xl sm:text-2xl font-black text-[#0B1F3A] tracking-tight uppercase">
                  RELATÓRIO DE CONFERÊNCIA DA IMPORTAÇÃO DE DESPESAS
                </h1>
                <p className="text-[11px] text-slate-500 max-w-lg mx-auto">
                  Demonstrativo consolidado de despesas extraídas, correspondência com o Plano de
                  Contas, memória de fornecedores recorrentes e lançamentos rápidos gerados.
                </p>
              </div>

              {/* Quadro Informativo da Empresa e Arquivos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs">
                <div className="space-y-1.5">
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Empresa de Destino:</span>
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
                    <span className="text-slate-500 font-semibold">Segmento / Ramo:</span>
                    <span className="text-slate-800 font-medium">
                      {empresa?.segmento || 'Geral'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 sm:border-l sm:border-slate-200 sm:pl-3">
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Arquivo(s) Processado(s):</span>
                    <span
                      className="font-medium text-blue-700 truncate max-w-[200px]"
                      title={arquivosImportados.map((a) => a.name).join(', ')}
                    >
                      {arquivosImportados.length > 0
                        ? arquivosImportados.map((a) => a.name).join(', ')
                        : 'Upload direto'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Responsável Técnico:</span>
                    <span className="text-slate-800 font-medium">
                      {minhaEmpresa?.contador_nome || 'Consultor Tributário'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Registro Profissional:</span>
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
            {/* QUADRO DE TOTAIS CONSOLIDADOS                             */}
            {/* ========================================================= */}
            <section className="space-y-3">
              <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  1
                </span>
                Totais Consolidados da Importação
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                    Total de Despesas
                  </span>
                  <p className="text-lg font-black text-slate-900 mt-0.5">{despesas.length}</p>
                  <span className="text-[10px] text-slate-500 block font-mono">
                    {formatBrl(totalGeral)}
                  </span>
                </div>

                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                  <span className="text-[10px] text-emerald-800 block uppercase font-semibold">
                    No Plano de Contas
                  </span>
                  <p className="text-lg font-black text-emerald-700 mt-0.5">
                    {cadastradas.length}{' '}
                    <span className="text-xs font-normal text-emerald-600">
                      (
                      {despesas.length > 0
                        ? Math.round((cadastradas.length / despesas.length) * 100)
                        : 0}
                      %)
                    </span>
                  </p>
                  <span className="text-[10px] text-emerald-700 block font-mono">
                    {formatBrl(cadastradasValor)}
                  </span>
                </div>

                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                  <span className="text-[10px] text-amber-800 block uppercase font-semibold">
                    Não Cadastradas
                  </span>
                  <p className="text-lg font-black text-amber-700 mt-0.5">
                    {naoCadastradas.length}{' '}
                    <span className="text-xs font-normal text-amber-600">
                      (
                      {despesas.length > 0
                        ? Math.round((naoCadastradas.length / despesas.length) * 100)
                        : 0}
                      %)
                    </span>
                  </p>
                  <span className="text-[10px] text-amber-700 block font-mono">
                    {formatBrl(naoCadastradasValor)}
                  </span>
                </div>

                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl">
                  <span className="text-[10px] text-indigo-800 block uppercase font-semibold">
                    Memória Recorrente
                  </span>
                  <p className="text-lg font-black text-indigo-700 mt-0.5">
                    {vindasDeMemoria.length}
                  </p>
                  <span className="text-[10px] text-indigo-600 block">
                    {vindasDeMemoria.length > 0 ? 'Fornecedores lembrados' : 'Nenhum histórico'}
                  </span>
                </div>
              </div>

              {resumoLancamentos && (
                <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-300 rounded-xl text-xs text-emerald-950 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <strong>Lançamentos Rápidos Gerados com Sucesso:</strong>{' '}
                      {resumoLancamentos.lancamentosCount} registros criados no sistema financeiro.
                    </div>
                  </div>
                  <div className="font-bold text-emerald-800 font-mono">
                    Valor Gravado: {formatBrl(resumoLancamentos.totalValor)}
                  </div>
                </div>
              )}
            </section>

            {/* ========================================================= */}
            {/* QUADRO DE CONTAS NOVAS CRIADAS (SE HOUVER)                */}
            {/* ========================================================= */}
            {novasContasCriadas.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                    2
                  </span>
                  Novas Contas Criadas no Plano de Contas ({novasContasCriadas.length})
                </h2>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                        <th className="py-2 px-3">Código PC</th>
                        <th className="py-2 px-3">Nome da Conta Criada</th>
                        <th className="py-2 px-3">Centro de Custo</th>
                        <th className="py-2 px-3">Tipo de Despesa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {novasContasCriadas.map((c, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-mono font-bold text-blue-700">
                            {c.codigo || `PC-NOVO-${i + 1}`}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-800">{c.nome}</td>
                          <td className="py-2 px-3 text-slate-600">{c.centro || 'Geral'}</td>
                          <td className="py-2 px-3 text-slate-600">{c.tipo || 'Operacional'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ========================================================= */}
            {/* RESUMO POR CATEGORIA                                      */}
            {/* ========================================================= */}
            <section className="space-y-2">
              <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  {novasContasCriadas.length > 0 ? '3' : '2'}
                </span>
                Resumo por Categoria de Despesa
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {gruposCategoria.map((g) => (
                  <div
                    key={g.categoria}
                    className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-start gap-1">
                      <strong className="text-slate-800 truncate" title={g.categoria}>
                        {g.categoria}
                      </strong>
                      <span className="text-[10px] font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        {g.quantidade} item(s)
                      </span>
                    </div>
                    <div className="mt-2 flex justify-between items-center text-[11px] pt-1.5 border-t border-slate-200/60">
                      <span className="font-mono font-bold text-emerald-700">
                        {formatBrl(g.totalValor)}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        ✓ {g.cadastradasCount} / ⚠️ {g.naoCadastradasCount}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ========================================================= */}
            {/* LISTA COMPLETA DE DESPESAS CONFERIDAS                     */}
            {/* ========================================================= */}
            <section className="space-y-2">
              <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  {novasContasCriadas.length > 0 ? '4' : '3'}
                </span>
                Lista Detalhada de Despesas Importadas ({despesas.length} itens)
              </h2>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                      <th className="py-2 px-2.5 w-20">Data</th>
                      <th className="py-2 px-2.5 min-w-[180px]">Descrição / Fornecedor</th>
                      <th className="py-2 px-2.5 min-w-[130px]">Categoria</th>
                      <th className="py-2 px-2.5 text-right w-24">Valor (R$)</th>
                      <th className="py-2 px-2.5 min-w-[180px]">Conta Contábil Vinculada</th>
                      <th className="py-2 px-2.5 min-w-[130px]">Origem Sugestão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {despesas.map((item) => (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-50/50 ${
                          !item.isCadastrada ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <td className="py-2 px-2.5 font-mono text-slate-700 whitespace-nowrap">
                          {item.data ? item.data.split('-').reverse().join('/') : '—'}
                        </td>
                        <td className="py-2 px-2.5">
                          <p className="font-semibold text-slate-900 leading-tight">
                            {item.descricao}
                          </p>
                          <span className="text-[9px] text-slate-400">
                            {item.sourceFile} · {item.pageOrRowInfo}
                          </span>
                        </td>
                        <td className="py-2 px-2.5">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {item.categoriaSugerida}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatBrl(item.valor)}
                        </td>
                        <td className="py-2 px-2.5">
                          {item.isCadastrada ? (
                            <div>
                              <span className="font-mono text-[9px] font-bold text-blue-700 bg-blue-50 px-1 py-0.5 rounded border border-blue-200 mr-1">
                                {item.planoContaCodigo || 'PC-???'}
                              </span>
                              <span className="font-medium text-slate-800">
                                {item.planoContaNome}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                              Não cadastrada no Plano
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2.5">
                          {item.matchConfidence === 'memoria' ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                              <History className="w-2.5 h-2.5" />
                              Memória Recorrente
                            </span>
                          ) : item.origemSugestao ? (
                            <span className="text-[9px] text-slate-500">{item.origemSugestao}</span>
                          ) : (
                            <span className="text-[9px] text-slate-400">Padrão IA</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
                      <td colSpan={3} className="py-2.5 px-2.5 text-xs">
                        Total Geral das Despesas ({despesas.length} itens)
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-xs font-mono text-emerald-700">
                        {formatBrl(totalGeral)}
                      </td>
                      <td colSpan={2} className="py-2.5 px-2.5 text-[10px] text-slate-500">
                        Cadastradas: {formatBrl(cadastradasValor)} | Não Cadastradas:{' '}
                        {formatBrl(naoCadastradasValor)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* ========================================================= */}
            {/* RODAPÉ E ASSINATURA TÉCNICA                               */}
            {/* ========================================================= */}
            <footer className="pt-6 border-t-2 border-slate-300 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-center text-xs">
                <div className="space-y-1 pt-6 border-t border-slate-300">
                  <p className="font-bold text-slate-900">
                    {empresa?.razao_social || empresa?.nome || 'Empresa Cliente'}
                  </p>
                  <p className="text-slate-500 text-[10px]">De acordo / Conferência Financeira</p>
                </div>

                <div className="space-y-1 pt-6 border-t border-slate-300">
                  <p className="font-bold text-[#0B1F3A]">
                    {minhaEmpresa?.contador_nome ||
                      minhaEmpresa?.razao_social ||
                      'Consultoria Contábil & Gestão Econômica'}
                  </p>
                  <p className="text-slate-500 text-[10px]">
                    {minhaEmpresa?.contador_crc
                      ? `CRC ${minhaEmpresa.contador_crc}${minhaEmpresa.contador_uf_crc ? `/${minhaEmpresa.contador_uf_crc}` : ''}`
                      : 'Auditoria de Inteligência Artificial'}
                  </p>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-400">
                Documento gerado automaticamente pelo módulo de Inteligência Artificial · GESTÃO
                ECONÔMICA E FINANCEIRA
              </div>
            </footer>

            {/* Rodapé fixo formal na impressão */}
            <DocumentPrintFooter
              documentTitle="Relatório de Conferência da Importação de Despesas (IA)"
              empresaNome={empresa?.razao_social || empresa?.nome}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
