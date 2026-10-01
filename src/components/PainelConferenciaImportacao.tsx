import React, { useState, useMemo } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Layers,
  ArrowRight,
  Filter,
  Info,
  Calendar,
  Building,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  ItemContaConferencia,
  ResumoConferenciaImportacao,
  StatusItemConferencia,
  MotivoNaoImportacao,
} from '@/services/conferenciaImportacaoService'
import { SeletorPlanoContaCombobox } from '@/components/SeletorPlanoContaCombobox'
import type { PlanoContaRecord } from '@/types/finance'

interface PainelConferenciaImportacaoProps {
  itens: ItemContaConferencia[]
  resumo: ResumoConferenciaImportacao
  planoContas: PlanoContaRecord[]
  empresaId: string
  ano: number
  isReimporting: boolean
  reimportProgress: number
  linhasProntasCount: number
  linhasBloqueadasCount: number
  onVincularContaItem: (itemContaId: string, planoContaId: string) => Promise<void> | void
  onReimportarPendencias: () => Promise<void> | void
  onAbrirAjusteDreLote?: (contasIds: string[]) => void
  onVoltarParaResumo?: () => void
  onAbrirCadastroNovaConta?: (nomeSugerido: string, itemContaId: string) => void
}

const formatarMoeda = (val: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0)
}

const getMotivoLabel = (motivo: MotivoNaoImportacao): string => {
  switch (motivo) {
    case 'sem_conta_vinculada':
      return 'Conta contábil não vinculada'
    case 'fora_periodo':
      return 'Fora do período/ano selecionado'
    case 'duplicidade_pulada':
      return 'Duplicidade (já existia no sistema)'
    case 'valor_invalido':
      return 'Valor zerado ou inválido'
    case 'desmarcada_usuario':
      return 'Desmarcada pelo usuário'
    case 'erro_gravacao':
      return 'Erro na gravação no banco'
    default:
      return 'Pendente'
  }
}

export function PainelConferenciaImportacao({
  itens,
  resumo,
  planoContas,
  empresaId,
  ano,
  isReimporting,
  reimportProgress,
  linhasProntasCount,
  linhasBloqueadasCount,
  onVincularContaItem,
  onReimportarPendencias,
  onAbrirAjusteDreLote,
  onVoltarParaResumo,
  onAbrirCadastroNovaConta,
}: PainelConferenciaImportacaoProps) {
  const [filtroStatus, setFiltroStatus] = useState<'todos' | StatusItemConferencia>('todos')
  const [busca, setBusca] = useState('')
  const [apenasSemDre, setApenasSemDre] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandirTodos = () => {
    setExpandedRows(new Set(itens.map((i) => i.id)))
  }

  const recolherTodos = () => {
    setExpandedRows(new Set())
  }

  const itensFiltrados = useMemo(() => {
    return itens.filter((item) => {
      if (filtroStatus !== 'todos' && item.statusGeral !== filtroStatus) return false
      if (apenasSemDre) {
        if (item.classificacaoDre && item.classificacaoDre !== 'Não classificados') return false
      }
      if (busca.trim()) {
        const q = busca.toLowerCase().trim()
        const matchNome = item.nomeContaPlanilha.toLowerCase().includes(q)
        const matchPlano = (item.planoContaNome || '').toLowerCase().includes(q)
        const matchCod = (item.codigoPlanilha || '').toLowerCase().includes(q)
        const matchPcCod = (item.planoContaCodigo || '').toLowerCase().includes(q)
        if (!matchNome && !matchPlano && !matchCod && !matchPcCod) return false
      }
      return true
    })
  }, [itens, filtroStatus, apenasSemDre, busca])

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Alerta contextual do feedback do usuário */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900">
              Conferência de Integridade: Planilha vs. Lançamentos Gravados
            </p>
            <p className="text-amber-800 text-[11px] mt-0.5 leading-relaxed">
              Solução para o relato:{' '}
              <em>
                &ldquo;Na importação de dados pelo Mapeamento com IA usando o EXCEL não veio todas
                as contas&rdquo;
              </em>
              . Aqui você confere todas as contas da planilha, identifica exatamente quais meses ou
              linhas não entraram, vincula as pendências e reimporta sem duplicar os dados já
              salvos.
            </p>
          </div>
        </div>

        {onVoltarParaResumo && (
          <Button
            variant="outline"
            size="sm"
            onClick={onVoltarParaResumo}
            className="text-xs h-8 bg-white border-amber-300 text-amber-900 hover:bg-amber-100 shrink-0"
          >
            Voltar ao Resumo
          </Button>
        )}
      </div>

      {/* Cards de Resumo Comparativo */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] uppercase font-bold text-slate-500">Contas na Planilha</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{resumo.totalContas}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {resumo.totalItensEsperados} meses/linhas
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-emerald-200 bg-emerald-50/20 shadow-xs">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] uppercase font-bold text-emerald-700">✅ 100% Importadas</p>
            <p className="text-xl font-bold text-emerald-700 mt-0.5">{resumo.contasImportadas}</p>
            <p className="text-[10px] text-emerald-600 mt-0.5">
              {resumo.totalItensGravados} gravados
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-amber-200 bg-amber-50/20 shadow-xs">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] uppercase font-bold text-amber-700">⚠️ Parciais</p>
            <p className="text-xl font-bold text-amber-700 mt-0.5">{resumo.contasParciais}</p>
            <p className="text-[10px] text-amber-600 mt-0.5">alguns meses faltantes</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-rose-200 bg-rose-50/20 shadow-xs">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] uppercase font-bold text-rose-700">❌ Não Importadas</p>
            <p className="text-xl font-bold text-rose-700 mt-0.5">{resumo.contasNaoImportadas}</p>
            <p className="text-[10px] text-rose-600 mt-0.5">
              {resumo.totalItensPendentes} meses pendentes
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] uppercase font-bold text-slate-500">Valor Planilha</p>
            <p className="text-sm font-bold text-slate-900 mt-1">
              {formatarMoeda(resumo.valorTotalEsperado)}
            </p>
            <p className="text-[10px] text-emerald-600 mt-0.5">
              Gravado: {formatarMoeda(resumo.valorTotalGravado)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-purple-200 bg-purple-50/20 shadow-xs">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] uppercase font-bold text-purple-700">Diferença a Gravar</p>
            <p className="text-sm font-bold text-purple-700 mt-1">
              {formatarMoeda(resumo.valorTotalPendente)}
            </p>
            <p className="text-[10px] text-purple-600 mt-0.5">
              {linhasProntasCount} prontos p/ reimportar
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Aviso de Contas sem Classificação DRE */}
      {resumo.contasSemClassificacaoDre > 0 && onAbrirAjusteDreLote && (
        <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-indigo-950 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
            <div>
              <p className="font-bold text-indigo-950">
                {resumo.contasSemClassificacaoDre}{' '}
                {resumo.contasSemClassificacaoDre === 1
                  ? 'conta importada está sem Classificação DRE'
                  : 'contas importadas estão sem Classificação DRE'}
              </p>
              <p className="text-[11px] text-indigo-800">
                Para que a DRE Gerencial (/gerencial/dre) agrupe os valores corretamente,
                classifique estas contas como Receita, Despesa Fixa, Despesa Variável ou Financeira.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => onAbrirAjusteDreLote(resumo.idsContasSemDre)}
            className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1.5 shrink-0 shadow-xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Ajustar Classificação DRE em Lote
          </Button>
        </div>
      )}

      {/* Ação de Reimportação e Barra de Progresso */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <RefreshCw
                  className={`w-4 h-4 text-blue-600 ${isReimporting ? 'animate-spin' : ''}`}
                />
                Reimportar Pendências da Planilha
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Grava <strong>somente o que falta</strong> ({linhasProntasCount} lançamentos
                prontos), pulando automaticamente o que já está salvo.
                {linhasBloqueadasCount > 0 && (
                  <span className="text-amber-700 font-medium ml-1">
                    ({linhasBloqueadasCount} itens ainda aguardam vínculo com o Plano de Contas
                    abaixo).
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setApenasSemDre(!apenasSemDre)}
                className={`text-xs h-9 ${apenasSemDre ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold' : 'text-slate-700 bg-white'}`}
              >
                <Filter className="w-3.5 h-3.5 mr-1 text-slate-500" />
                {apenasSemDre ? 'Mostrando Sem DRE' : 'Filtrar Sem DRE'}
              </Button>

              <Button
                disabled={isReimporting || linhasProntasCount === 0}
                onClick={onReimportarPendencias}
                className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2 shadow-xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isReimporting ? 'animate-spin' : ''}`} />
                {isReimporting
                  ? 'Reimportando...'
                  : `Reimportar Pendências (${linhasProntasCount})`}
              </Button>
            </div>
          </div>

          {isReimporting && (
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-xs text-slate-600 font-medium">
                <span>Gravando pendências...</span>
                <span>{reimportProgress}%</span>
              </div>
              <Progress value={reimportProgress} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Barra de Filtros da Tabela de Conferência */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={filtroStatus === 'todos' ? 'default' : 'outline'}
            onClick={() => setFiltroStatus('todos')}
            className="text-xs h-8"
          >
            Todas ({itens.length})
          </Button>
          <Button
            size="sm"
            variant={filtroStatus === 'nao_importado' ? 'default' : 'outline'}
            onClick={() => setFiltroStatus('nao_importado')}
            className="text-xs h-8 text-rose-700 border-rose-200 hover:bg-rose-50"
          >
            ❌ Não importadas ({resumo.contasNaoImportadas})
          </Button>
          <Button
            size="sm"
            variant={filtroStatus === 'parcial' ? 'default' : 'outline'}
            onClick={() => setFiltroStatus('parcial')}
            className="text-xs h-8 text-amber-700 border-amber-200 hover:bg-amber-50"
          >
            ⚠️ Parciais ({resumo.contasParciais})
          </Button>
          <Button
            size="sm"
            variant={filtroStatus === 'importado' ? 'default' : 'outline'}
            onClick={() => setFiltroStatus('importado')}
            className="text-xs h-8 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
          >
            ✅ 100% OK ({resumo.contasImportadas})
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Buscar conta ou código..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="text-xs h-8 pl-8 bg-white border-slate-300"
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={expandedRows.size === itensFiltrados.length ? recolherTodos : expandirTodos}
            className="text-xs h-8 text-slate-600 hover:text-slate-900"
          >
            {expandedRows.size === itensFiltrados.length ? 'Recolher Todos' : 'Expandir Todos'}
          </Button>
        </div>
      </div>

      {/* Tabela de Itens de Conferência */}
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[580px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-700 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3 w-8"></th>
                <th className="p-3">Conta na Planilha</th>
                <th className="p-3">Vínculo Plano de Contas</th>
                <th className="p-3 text-center">Classificação DRE</th>
                <th className="p-3 text-center">Meses Gravados</th>
                <th className="p-3 text-right">Valor Planilha</th>
                <th className="p-3 text-right">Valor Gravado</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itensFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    Nenhuma conta encontrada com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                itensFiltrados.map((item) => {
                  const isExpanded = expandedRows.has(item.id)
                  const hasPending = item.statusGeral !== 'importado'
                  const noDre =
                    !item.classificacaoDre || item.classificacaoDre === 'Não classificados'

                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        className={`hover:bg-slate-50/80 transition-colors ${
                          item.statusGeral === 'nao_importado'
                            ? 'bg-rose-50/20'
                            : item.statusGeral === 'parcial'
                              ? 'bg-amber-50/20'
                              : ''
                        }`}
                      >
                        {/* Toggle expandir */}
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleRow(item.id)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700"
                            title="Ver detalhe dos meses"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* Conta Planilha */}
                        <td className="p-3">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            {item.nomeContaPlanilha}
                            {item.codigoPlanilha && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                {item.codigoPlanilha}
                              </span>
                            )}
                          </div>
                          {item.detalhesMotivos.length > 0 && (
                            <p className="text-[10px] text-rose-600 mt-0.5 font-medium">
                              Motivo: {item.detalhesMotivos.join('; ')}
                            </p>
                          )}
                        </td>

                        {/* Vínculo Plano de Contas (com Seletor) */}
                        <td className="p-3 min-w-[260px]">
                          <div className="space-y-1">
                            <SeletorPlanoContaCombobox
                              value={item.planoContaId || ''}
                              onValueChange={(val) => onVincularContaItem(item.id, val)}
                              planoContas={planoContas}
                              empresaAtivaId={empresaId}
                              placeholder="Vincular ao Plano de Contas..."
                              className="h-8 text-xs bg-white"
                              allowClear
                            />
                            {!item.planoContaId && onAbrirCadastroNovaConta && (
                              <button
                                type="button"
                                onClick={() =>
                                  onAbrirCadastroNovaConta(item.nomeContaPlanilha, item.id)
                                }
                                className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold underline flex items-center gap-1"
                              >
                                + Cadastrar Conta Nova Rápida
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Classificação DRE */}
                        <td className="p-3 text-center">
                          {item.classificacaoDre &&
                          item.classificacaoDre !== 'Não classificados' ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-semibold bg-emerald-50 text-emerald-800 border-emerald-300"
                            >
                              {item.classificacaoDre}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-semibold bg-amber-50 text-amber-800 border-amber-300"
                            >
                              Não Classificado
                            </Badge>
                          )}
                        </td>

                        {/* Meses Gravados */}
                        <td className="p-3 text-center">
                          <span
                            className={`font-semibold ${
                              item.totalLinhasGravadas === item.totalLinhasEsperadas
                                ? 'text-emerald-700'
                                : item.totalLinhasGravadas > 0
                                  ? 'text-amber-700'
                                  : 'text-rose-700'
                            }`}
                          >
                            {item.totalLinhasGravadas} / {item.totalLinhasEsperadas}
                          </span>
                        </td>

                        {/* Valor Planilha */}
                        <td className="p-3 text-right font-medium text-slate-900">
                          {formatarMoeda(item.somaValorPlanilha)}
                        </td>

                        {/* Valor Gravado */}
                        <td className="p-3 text-right font-medium text-emerald-700">
                          {formatarMoeda(item.somaValorGravado)}
                        </td>

                        {/* Status */}
                        <td className="p-3 text-center">
                          {item.statusGeral === 'importado' && (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] hover:bg-emerald-100 font-semibold">
                              ✅ 100% OK
                            </Badge>
                          )}
                          {item.statusGeral === 'parcial' && (
                            <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] hover:bg-amber-100 font-semibold">
                              ⚠️ Parcial
                            </Badge>
                          )}
                          {item.statusGeral === 'nao_importado' && (
                            <Badge className="bg-rose-100 text-rose-900 border-rose-300 text-[10px] hover:bg-rose-100 font-semibold">
                              ❌ Não Gravado
                            </Badge>
                          )}
                        </td>
                      </tr>

                      {/* Linha expandida com detalhamento dos meses */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 border-b border-slate-200">
                          <td colSpan={8} className="p-4 pl-12">
                            <div className="space-y-2">
                              <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                Detalhamento dos Meses no Ano {ano}
                              </p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                {item.meses.map((m) => (
                                  <div
                                    key={m.mes}
                                    className={`p-2 rounded-lg border text-xs space-y-1 ${
                                      m.gravado
                                        ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                                        : 'bg-rose-50/60 border-rose-200 text-rose-950'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between font-semibold">
                                      <span>{m.rotuloMes}</span>
                                      {m.gravado ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      ) : (
                                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                      )}
                                    </div>
                                    <p className="text-slate-700 font-medium">
                                      Planilha: {formatarMoeda(m.valorPlanilha)}
                                    </p>
                                    <p
                                      className={
                                        m.gravado
                                          ? 'text-emerald-700'
                                          : 'text-rose-700 font-semibold'
                                      }
                                    >
                                      {m.gravado
                                        ? `Gravado: ${formatarMoeda(m.valorGravado)}`
                                        : m.motivo
                                          ? getMotivoLabel(m.motivo)
                                          : 'Pendente'}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
