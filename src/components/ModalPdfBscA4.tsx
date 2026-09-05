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
  Download,
  AlertTriangle,
  ExternalLink,
  Target,
  TrendingUp,
  Users,
  Cpu,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Zap,
  Building2,
  Calendar,
  Layers,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Link } from 'react-router-dom'
import type {
  EmpresaRecord,
  MinhaEmpresaRecord,
  BscKpiRecord,
  BscPerspectiva,
  BscIniciativaRecord,
} from '@/types/finance'
import { formatCnpj } from '@/lib/financeCalculations'

export interface ResumoPerspectivaPdf {
  perspectiva: BscPerspectiva
  nome: string
  subtitulo: string
  score: number
  total: number
  atingidos: number
  proximos: number
  abaixo: number
  kpis: {
    kpi: BscKpiRecord
    apuradoStr: string
    metaStr: string
    pct: number
    status: 'atingido' | 'proximo' | 'abaixo' | 'indefinido'
  }[]
}

export interface ModalPdfBscA4Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedEmpresa: EmpresaRecord | null
  selectedAno: number
  minhaEmpresa: MinhaEmpresaRecord | null
  logoUrl: string | null
  scoreGlobal: number
  statusSemaforoGlobal: 'verde' | 'ambar' | 'vermelho'
  resumosPerspectivas: ResumoPerspectivaPdf[]
  totalKpisCount: number
  iniciativas?: BscIniciativaRecord[]
}

export function ModalPdfBscA4({
  open,
  onOpenChange,
  selectedEmpresa,
  selectedAno,
  minhaEmpresa,
  logoUrl,
  scoreGlobal,
  statusSemaforoGlobal,
  resumosPerspectivas,
  totalKpisCount,
  iniciativas = [],
}: ModalPdfBscA4Props) {
  const { toast } = useToast()

  const dataEmissao = useMemo(() => {
    return new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }, [])

  const hasMinhaEmpresa = !!(
    minhaEmpresa?.razao_social ||
    minhaEmpresa?.nome_fantasia ||
    minhaEmpresa?.contador_nome
  )

  const handlePrint = () => {
    window.print()
  }

  const handleExportCSV = () => {
    if (!selectedEmpresa) {
      toast({
        variant: 'destructive',
        title: 'Empresa não selecionada',
        description: 'É necessário ter uma empresa selecionada para exportar os dados do BSC.',
      })
      return
    }

    let csv = '\uFEFF' // UTF-8 BOM
    csv += `LAUDO EXECUTIVO - BALANCED SCORECARD (BSC)\n`
    csv += `Empresa;${selectedEmpresa.nome}\n`
    csv += `CNPJ;${selectedEmpresa.cnpj ? formatCnpj(selectedEmpresa.cnpj) : '—'}\n`
    csv += `Exercício Base;${selectedAno}\n`
    csv += `Score Global BSC;${scoreGlobal}%\n`
    csv += `Data de Emissão;${dataEmissao}\n\n`

    csv += `Perspectiva;Indicador (KPI);Tipo;Meta;Real Apurado;Atingimento (%);Situação;Peso (%)\n`
    resumosPerspectivas.forEach((p) => {
      p.kpis.forEach((item) => {
        const sit =
          item.status === 'atingido'
            ? 'Atingido (>=90%)'
            : item.status === 'proximo'
              ? 'Próximo (70-89%)'
              : item.status === 'abaixo'
                ? 'Abaixo (<70%)'
                : 'Pendente'
        csv += `"${p.nome}";"${item.kpi.nome}";"${item.kpi.tipo === 'auto' ? 'Automático' : 'Manual'}";"${item.metaStr}";"${item.apuradoStr}";"${item.pct}%";"${sit}";"${item.kpi.peso || 10}%"\n`
      })
    })

    if (iniciativas.length > 0) {
      csv += `\n--- PLANOS DE AÇÃO / INICIATIVAS VINCULADAS ---\n`
      csv += `Título;KPI;Responsável;Prazo;Status;Progresso (%)\n`
      iniciativas.forEach((ini) => {
        csv += `"${ini.titulo}";"${ini.expand?.kpi?.nome || 'KPI'}";"${ini.responsavel || '—'}";"${ini.prazo || '—'}";"${ini.status}";"${ini.progresso ?? 0}%"\n`
      })
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute(
      'download',
      `Laudo_BSC_${selectedEmpresa.nome.replace(/\s+/g, '_')}_${selectedAno}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: 'CSV Exportado com Sucesso',
      description: 'O laudo do BSC com todas as perspectivas foi baixado.',
    })
  }

  const getPerspectivaIcon = (id: BscPerspectiva) => {
    switch (id) {
      case 'financeira':
        return TrendingUp
      case 'clientes':
        return Users
      case 'processos_internos':
        return Cpu
      case 'aprendizado_crescimento':
        return GraduationCap
      default:
        return Target
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 gap-0 bg-slate-100/90 border-slate-300">
        {/* Barra superior de Ações no Modal (oculta na impressão) */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-[#0B1F3A]">
                Laudo Executivo Balanced Scorecard (Padrão A4)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Apresentação formal da estratégia e scorecard para o cliente
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-8 text-xs font-semibold gap-1 text-slate-700 hover:bg-slate-100"
              title="Exportar dados do BSC em planilha CSV"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
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
                  <strong>Atenção:</strong> Os dados da sua consultoria (nome/logotipo) e do
                  consultor/contador responsável (CRC) podem ser configurados para compor o
                  cabeçalho deste documento.
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
            id="laudo-bsc-document"
            className="w-full max-w-[800px] bg-white border border-slate-300 rounded-xl shadow-lg p-8 sm:p-12 text-slate-800 text-xs leading-relaxed space-y-7 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:bg-white font-sans"
          >
            {/* CABEÇALHO CORPORATIVO FORMAL */}
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
                        'Consultoria & Controladoria Estratégica'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {minhaEmpresa?.cnpj
                        ? `CNPJ: ${formatCnpj(minhaEmpresa.cnpj)}`
                        : 'Planejamento Estratégico & Gestão de Performance'}
                    </p>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700 block">Data de Emissão</span>
                  <span>{dataEmissao}</span>
                </div>
              </div>

              {/* Título do Documento */}
              <div className="text-center py-2 space-y-1">
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-800 border-blue-200 text-[10px] font-bold px-3 py-0.5 uppercase tracking-wider"
                >
                  Balanced Scorecard (BSC) · Laudo Estratégico
                </Badge>
                <h1 className="text-xl sm:text-2xl font-black text-[#0B1F3A] tracking-tight uppercase">
                  SCORECARD ESTRATÉGICO DE PERFORMANCE
                </h1>
                <p className="text-[11px] text-slate-500 max-w-xl mx-auto">
                  Avaliação integrada das 4 perspectivas corporativas com semáforo de metas,
                  apuração automática de demonstrativos e iniciativas de melhoria contínua.
                </p>
              </div>

              {/* Quadro Informativo do Cliente e Exercício */}
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
                    <span className="text-slate-500 font-semibold">Segmento de Atuação:</span>
                    <span className="text-slate-800 font-medium">
                      {selectedEmpresa?.segmento || 'Geral'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 sm:border-l sm:border-slate-200 sm:pl-3">
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Exercício-Base:</span>
                    <strong className="text-blue-700 font-bold">{selectedAno}</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Total de Indicadores:</span>
                    <span className="font-mono font-bold text-[#0B1F3A]">
                      {totalKpisCount} KPIs nas 4 dimensões
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Consultor Responsável:</span>
                    <span className="text-slate-800 font-medium">
                      {minhaEmpresa?.contador_nome || 'Consultor Estratégico'}
                    </span>
                  </div>
                </div>
              </div>
            </header>

            {/* SEÇÃO 1: SCORECARD GLOBAL E RESUMO EXECUTIVO */}
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  1
                </span>
                Score Global de Execução e Semáforo das Perspectivas ({selectedAno})
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                {/* Score Global */}
                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1 sm:col-span-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    Scorecard Ponderado
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span
                      className={`text-3xl font-extrabold font-mono ${
                        statusSemaforoGlobal === 'verde'
                          ? 'text-emerald-700'
                          : statusSemaforoGlobal === 'ambar'
                            ? 'text-amber-700'
                            : 'text-red-700'
                      }`}
                    >
                      {scoreGlobal}%
                    </span>
                  </div>
                  <Badge
                    className={`text-[9px] px-1.5 py-0.5 font-bold mt-1 ${
                      statusSemaforoGlobal === 'verde'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : statusSemaforoGlobal === 'ambar'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-red-50 text-red-800 border-red-300'
                    }`}
                  >
                    {statusSemaforoGlobal === 'verde' && '🟢 Alto Atingimento (≥90%)'}
                    {statusSemaforoGlobal === 'ambar' && '🟡 Atenção / Médio (70–89%)'}
                    {statusSemaforoGlobal === 'vermelho' && '🔴 Crítico / Abaixo (<70%)'}
                  </Badge>
                </div>

                {/* Síntese das 4 Perspectivas */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:col-span-3">
                  {resumosPerspectivas.map((p) => {
                    const status = p.score >= 90 ? 'verde' : p.score >= 70 ? 'ambar' : 'vermelho'
                    return (
                      <div
                        key={p.perspectiva}
                        className="p-2.5 bg-white rounded-lg border border-slate-200 flex flex-col justify-between"
                      >
                        <span className="text-[10px] font-bold text-slate-700 line-clamp-1">
                          {p.nome}
                        </span>
                        <div className="flex items-baseline justify-between mt-1">
                          <strong className="text-lg font-mono font-bold text-slate-900">
                            {p.score}%
                          </strong>
                          <span className="text-[10px]">
                            {status === 'verde' && '🟢'}
                            {status === 'ambar' && '🟡'}
                            {status === 'vermelho' && '🔴'}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-500 mt-1">
                          {p.atingidos} at. · {p.proximos} próx. · {p.abaixo} ab.
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>

            {/* SEÇÃO 2: DETALHAMENTO DAS 4 PERSPECTIVAS DO BSC */}
            <section className="space-y-4">
              <h2 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  2
                </span>
                Quadro Detalhado por Perspectiva e Indicadores (KPIs)
              </h2>

              <div className="space-y-4">
                {resumosPerspectivas.map((p) => {
                  const Icon = getPerspectivaIcon(p.perspectiva)
                  return (
                    <div
                      key={p.perspectiva}
                      className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs"
                    >
                      {/* Cabeçalho da Perspectiva */}
                      <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-blue-700" />
                          <span className="font-bold text-slate-900 text-xs">
                            Perspectiva {p.nome}
                          </span>
                          <span className="text-[11px] text-slate-500 italic hidden sm:inline">
                            — {p.subtitulo}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-blue-100 text-blue-900 border-blue-200 text-[10px] font-bold">
                            Score: {p.score}%
                          </Badge>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {p.kpis.length} KPIs
                          </span>
                        </div>
                      </div>

                      {/* Tabela de KPIs da Perspectiva */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] text-slate-600 font-bold uppercase">
                              <th className="py-2 px-3 w-[34%]">Indicador (KPI)</th>
                              <th className="py-2 px-2 text-center w-[12%]">Tipo</th>
                              <th className="py-2 px-2 text-right w-[14%]">Meta Pactuada</th>
                              <th className="py-2 px-2 text-right w-[16%]">Resultado Real</th>
                              <th className="py-2 px-2 text-center w-[12%]">Atingimento</th>
                              <th className="py-2 px-2 text-center w-[12%]">Situação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-[11px]">
                            {p.kpis.map(({ kpi, apuradoStr, metaStr, pct, status }) => {
                              const semaforo =
                                status === 'atingido'
                                  ? {
                                      label: '🟢 Atingido',
                                      badge: 'bg-emerald-50 text-emerald-800',
                                    }
                                  : status === 'proximo'
                                    ? { label: '🟡 Próximo', badge: 'bg-amber-50 text-amber-800' }
                                    : status === 'abaixo'
                                      ? { label: '🔴 Abaixo', badge: 'bg-red-50 text-red-800' }
                                      : {
                                          label: '— Pendente',
                                          badge: 'bg-slate-100 text-slate-600',
                                        }

                              return (
                                <tr key={kpi.id} className="hover:bg-slate-50/70">
                                  <td className="py-2 px-3">
                                    <div className="font-semibold text-slate-900">{kpi.nome}</div>
                                    {kpi.descricao && (
                                      <p className="text-[10px] text-slate-400 line-clamp-1">
                                        {kpi.descricao}
                                      </p>
                                    )}
                                  </td>
                                  <td className="py-2 px-2 text-center text-[10px]">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                                        kpi.tipo === 'auto'
                                          ? 'bg-blue-50 text-blue-700'
                                          : 'bg-slate-100 text-slate-700'
                                      }`}
                                    >
                                      {kpi.tipo === 'auto' ? 'Auto (DRE/Bal)' : 'Manual'}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono font-medium text-slate-800">
                                    {metaStr}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                                    {apuradoStr}
                                  </td>
                                  <td className="py-2 px-2 text-center font-mono font-semibold text-slate-800">
                                    {status === 'indefinido' ? '—' : `${pct}%`}
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    <Badge
                                      className={`text-[9px] px-1.5 py-0.5 font-bold ${semaforo.badge}`}
                                    >
                                      {semaforo.label}
                                    </Badge>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* SEÇÃO 3: PLANOS DE AÇÃO E INICIATIVAS VINCULADAS */}
            {iniciativas.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                    3
                  </span>
                  Planos de Ação e Iniciativas Estratégicas Pactuadas
                </h2>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 font-bold text-slate-700 border-b border-slate-200 text-[10px]">
                        <th className="py-2 px-3">Iniciativa / Plano de Ação</th>
                        <th className="py-2 px-2">KPI Vinculado</th>
                        <th className="py-2 px-2">Responsável</th>
                        <th className="py-2 px-2 text-center">Prazo</th>
                        <th className="py-2 px-2 text-center">Status</th>
                        <th className="py-2 px-2 text-right">Progresso</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[10px]">
                      {iniciativas.map((ini) => (
                        <tr key={ini.id} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-medium text-slate-900">
                            <div>{ini.titulo}</div>
                            {ini.descricao && (
                              <p className="text-[9px] text-slate-400 line-clamp-1">
                                {ini.descricao}
                              </p>
                            )}
                          </td>
                          <td className="py-2 px-2 text-slate-700">
                            {ini.expand?.kpi?.nome || '—'}
                          </td>
                          <td className="py-2 px-2 text-slate-700">{ini.responsavel || '—'}</td>
                          <td className="py-2 px-2 text-center text-slate-600 font-mono">
                            {ini.prazo
                              ? new Date(ini.prazo).toLocaleDateString('pt-BR')
                              : 'A definir'}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                ini.status === 'concluida'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : ini.status === 'em_andamento'
                                    ? 'bg-blue-100 text-blue-800'
                                    : ini.status === 'planejada'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {ini.status === 'concluida'
                                ? 'Concluída'
                                : ini.status === 'em_andamento'
                                  ? 'Em Andamento'
                                  : ini.status === 'planejada'
                                    ? 'Planejada'
                                    : 'Cancelada'}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-slate-800">
                            {ini.progresso ?? 0}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* SEÇÃO 4: NOTAS METODOLÓGICAS E ASSINATURA DO CONSULTOR */}
            <section className="space-y-4 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed space-y-1">
                <strong className="text-slate-800 font-bold block">
                  Metodologia e Critério do Semáforo BSC:
                </strong>
                <p>
                  1. O scorecard ponderado agrega os pesos de cada KPI, respeitando a direção da
                  métrica (maior é melhor vs. menor é melhor). O semáforo adota as faixas
                  corporativas: <strong>🟢 ≥ 90% (Meta Atingida)</strong>,{' '}
                  <strong>🟡 70% a 89% (Zona de Atenção)</strong> e{' '}
                  <strong>🔴 &lt; 70% (Crítico / Desvio Expressivo)</strong>.
                </p>
                <p>
                  2. Os indicadores automáticos são apurados em tempo real diretamente a partir do
                  Balanço Patrimonial e DRE auditados no sistema para o exercício {selectedAno}.
                </p>
              </div>

              {/* Assinatura do Consultor / Responsável */}
              <div className="pt-6 flex flex-col items-center justify-center text-center space-y-1">
                <div className="w-64 border-t border-slate-400 pt-2 font-bold text-slate-800 text-xs">
                  {minhaEmpresa?.contador_nome || 'Consultor / Contador Responsável'}
                </div>
                <p className="text-[11px] text-slate-500">
                  {minhaEmpresa?.contador_crc
                    ? `Registro Profissional: CRC ${minhaEmpresa.contador_crc}${
                        minhaEmpresa.contador_uf_crc ? `/${minhaEmpresa.contador_uf_crc}` : ''
                      }`
                    : 'Controladoria & Diagnóstico de Gestão'}
                </p>
                <p className="text-[10px] text-slate-400">
                  {minhaEmpresa?.razao_social ||
                    minhaEmpresa?.nome_fantasia ||
                    selectedEmpresa?.nome}
                </p>
              </div>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
export default ModalPdfBscA4
