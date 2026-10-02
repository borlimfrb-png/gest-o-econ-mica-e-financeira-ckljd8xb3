import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Database,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  Info,
  RefreshCw,
} from 'lucide-react'
import type {
  PreviewImportacaoDreResultado,
  PreviewPeriodoDre,
  ResumoFinalImportacaoDre,
} from '@/services/dreImportacaoService'
import { executarImportacaoDre } from '@/services/dreImportacaoService'
import { formatCurrency } from '@/lib/financeCalculations'
import { useToast } from '@/hooks/use-toast'

interface ModalImportarDreGerencialProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  previewData: PreviewImportacaoDreResultado | null
  onSuccess?: (resumo: ResumoFinalImportacaoDre) => void
}

export function ModalImportarDreGerencial({
  open,
  onOpenChange,
  previewData,
  onSuccess,
}: ModalImportarDreGerencialProps) {
  const { toast } = useToast()
  const [salvando, setSalvando] = useState(false)
  const [resumoFinal, setResumoFinal] = useState<ResumoFinalImportacaoDre | null>(null)
  const [periodoSelecionadoIndex, setPeriodoSelecionadoIndex] = useState<number>(0)
  const [confirmacaoSobrescrita, setConfirmacaoSobrescrita] = useState<boolean>(false)

  // Reseta estados locais ao reabrir
  React.useEffect(() => {
    if (open) {
      setResumoFinal(null)
      setPeriodoSelecionadoIndex(0)
      setConfirmacaoSobrescrita(false)
    }
  }, [open])

  if (!previewData) return null

  const { empresaDestino, periodos, totalPeriodos, periodosExistentes, periodosNovos } = previewData

  const periodoAtivo: PreviewPeriodoDre | undefined =
    periodos[periodoSelecionadoIndex] || periodos[0]

  const handleConfirmarImportacao = async () => {
    if (periodosExistentes > 0 && !confirmacaoSobrescrita) {
      setConfirmacaoSobrescrita(true)
      return
    }

    try {
      setSalvando(true)
      const resultado = await executarImportacaoDre({
        empresaId: empresaDestino.id,
        empresaNome: empresaDestino.nome,
        periodosParaGravar: periodos,
      })

      setResumoFinal(resultado)

      if (resultado.falhas === 0) {
        toast({
          title: 'Importação Concluída com Sucesso!',
          description: `${resultado.totalProcessados} período(s) gravado(s)/atualizado(s) na DRE do sistema. O Dashboard e as Análises já foram atualizados.`,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Importação concluída com avisos',
          description: `${resultado.atualizados + resultado.criados} gravados com sucesso, mas ${resultado.falhas} falharam.`,
        })
      }

      if (onSuccess) {
        onSuccess(resultado)
      }
    } catch (err: any) {
      console.error('Erro na importação da DRE gerencial:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao importar',
        description: err?.message || 'Falha ao processar importação no banco de dados.',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-white">
        {/* Cabeçalho */}
        <DialogHeader className="p-5 pb-3 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                Importar Resultado da DRE Gerencial para a DRE do Sistema
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Alimente a base oficial da DRE para ativar em tempo real os indicadores de
                rentabilidade, margem líquida, ROE, EBITDA, giro e liquidez no Dashboard e nas
                Análises.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Conteúdo com rolagem */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {resumoFinal ? (
            /* ==============================================================
               TELA DE RESUMO FINAL PÓS-GRAVAÇÃO
            ============================================================== */
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-emerald-900">
                    Importação Realizada com Sucesso!
                  </h4>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    Os dados foram persistidos na coleção{' '}
                    <code className="font-mono font-semibold bg-emerald-100/60 px-1 py-0.5 rounded text-[11px]">
                      dre
                    </code>{' '}
                    para a empresa <strong>{resumoFinal.empresaNome}</strong>.
                  </p>
                  <p className="text-xs text-emerald-700">
                    Os indicadores de{' '}
                    <strong>
                      ROE, Margem Líquida, Lucro Líquido, EBITDA, Ponto de Equilíbrio e Termômetro
                      de Kanitz
                    </strong>{' '}
                    já refletem imediatamente esses valores em tempo real.
                  </p>
                </div>
              </div>

              {/* Estatísticas resumidas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Total Processado</p>
                  <p className="text-base font-bold text-slate-900 mt-0.5">
                    {resumoFinal.totalProcessados} período(s)
                  </p>
                </div>
                <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200">
                  <p className="text-[10px] uppercase font-bold text-blue-600">Novos Registros</p>
                  <p className="text-base font-bold text-blue-800 mt-0.5">{resumoFinal.criados}</p>
                </div>
                <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200">
                  <p className="text-[10px] uppercase font-bold text-amber-700">Atualizados</p>
                  <p className="text-base font-bold text-amber-900 mt-0.5">
                    {resumoFinal.atualizados}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Falhas</p>
                  <p
                    className={`text-base font-bold mt-0.5 ${resumoFinal.falhas > 0 ? 'text-rose-600' : 'text-slate-700'}`}
                  >
                    {resumoFinal.falhas}
                  </p>
                </div>
              </div>

              {/* Tabela de períodos processados */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-100/80 px-3 py-2 font-bold text-[11px] text-slate-700">
                  Histórico detalhado por competência
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[10px] uppercase">
                    <tr>
                      <th className="py-2 px-3 text-left">Competência</th>
                      <th className="py-2 px-3 text-left">Status</th>
                      <th className="py-2 px-3 text-left">Ação</th>
                      <th className="py-2 px-3 text-right">Resultado Apurado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {resumoFinal.detalhes.map((det) => (
                      <tr key={det.chaveMes} className="hover:bg-slate-50/60">
                        <td className="py-2 px-3 font-semibold text-slate-800">
                          {det.chaveMes} ({det.mes}/{det.ano})
                        </td>
                        <td className="py-2 px-3">
                          {det.sucesso ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                              Sucesso
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]">
                              {det.erro || 'Erro'}
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {det.acao === 'criado'
                            ? 'Novo registro criado'
                            : 'Registro existente atualizado'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {det.dreGravada
                            ? formatCurrency(
                                (det.dreGravada.receita_bruta || 0) -
                                  (det.dreGravada.custo_mercadorias || 0) -
                                  (det.dreGravada.despesas_operacionais || 0) -
                                  (det.dreGravada.despesas_financeiras || 0) +
                                  (det.dreGravada.outras_receitas_despesas || 0),
                              )
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ==============================================================
               TELA DE PRÉ-VISUALIZAÇÃO E CONFIRMAÇÃO
            ============================================================== */
            <>
              {/* Contexto da Empresa e Período */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/90">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">
                      Empresa Destino
                    </span>
                    <p className="font-bold text-slate-900 truncate" title={empresaDestino.nome}>
                      {empresaDestino.nome}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">
                      Períodos a Importar
                    </span>
                    <p className="font-bold text-slate-900">
                      {totalPeriodos} mês(es) ({periodos[0]?.chaveMes} a{' '}
                      {periodos[periodos.length - 1]?.chaveMes})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">
                      Condição dos Dados
                    </span>
                    <p className="font-bold text-slate-900">
                      {periodosExistentes > 0 ? (
                        <span className="text-amber-700">
                          {periodosExistentes} existente(s) · {periodosNovos} novo(s)
                        </span>
                      ) : (
                        <span className="text-emerald-700">Todos os {periodosNovos} são novos</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Alerta de Substituição se houver DREs existentes */}
              {periodosExistentes > 0 && (
                <Alert className="border-amber-300 bg-amber-50/80 text-amber-900">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-xs font-bold text-amber-900">
                    Atenção: Substituição de Dados Existentes
                  </AlertTitle>
                  <AlertDescription className="text-[11px] text-amber-800 leading-relaxed mt-1">
                    Já existem registros de DRE gravados no sistema para{' '}
                    <strong>{periodosExistentes}</strong> do(s) período(s) selecionado(s). Ao
                    confirmar, os valores anteriores serão atualizados e sobrescritos com base nos
                    totais da DRE Gerencial calculada a partir dos lançamentos rápidos.
                  </AlertDescription>
                </Alert>
              )}

              {/* Seletor de Período para drill-down do mapeamento */}
              {periodos.length > 1 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 uppercase">
                      Selecione um mês para inspecionar os valores mapeados:
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {periodos.length} períodos no lote
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                    {periodos.map((p, idx) => {
                      const isSel = idx === periodoSelecionadoIndex
                      return (
                        <button
                          key={p.chaveMes}
                          type="button"
                          onClick={() => setPeriodoSelecionadoIndex(idx)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                            isSel
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span>{p.mesRotulo}</span>
                          {p.jaExiste && (
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1 py-0 h-3.5 ${
                                isSel
                                  ? 'border-white/50 text-white'
                                  : 'border-amber-300 text-amber-700 bg-amber-50'
                              }`}
                            >
                              Sobrescreve
                            </Badge>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Detalhamento do Período Ativo: Comparação De -> Para */}
              {periodoAtivo && (
                <div className="space-y-3 border border-slate-200 rounded-xl p-4 bg-white">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        Mapeamento de Campos: DRE Gerencial → DRE do Sistema (
                        {periodoAtivo.mesRotulo})
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        Cada grupo da DRE Gerencial é vinculado ao campo contábil correspondente na
                        coleção oficial.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 font-semibold">
                        Resultado Final:
                      </span>
                      <Badge
                        className={`text-xs font-bold font-mono ${
                          periodoAtivo.lucroOuPrejuizo >= 0
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : 'bg-rose-100 text-rose-900 border-rose-300'
                        }`}
                      >
                        {formatCurrency(periodoAtivo.lucroOuPrejuizo)}
                      </Badge>
                    </div>
                  </div>

                  {/* Tabela do De -> Para */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-left text-[10px] uppercase">
                          <th className="py-2 px-3">Origem (DRE Gerencial)</th>
                          <th className="py-2 px-2 text-center w-8"></th>
                          <th className="py-2 px-3">Campo Oficial (Coleção DRE)</th>
                          <th className="py-2 px-3 text-right">Valor Apurado</th>
                          {periodoAtivo.jaExiste && (
                            <th className="py-2 px-3 text-right text-amber-700">Valor Anterior</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {periodoAtivo.mapeamentos.map((m) => {
                          const valorAnterior = periodoAtivo.dreExistente
                            ? Number(periodoAtivo.dreExistente[m.campoDre]) || 0
                            : undefined

                          return (
                            <tr key={m.campoDre} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3 font-semibold text-slate-800">
                                {m.origemGerencial}
                              </td>
                              <td className="py-2 px-2 text-center text-slate-400">
                                <ArrowRight className="w-3.5 h-3.5 inline text-slate-400" />
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-slate-900">{m.rotuloDre}</span>
                                  <code className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1 py-0.2 rounded">
                                    {m.campoDre}
                                  </code>
                                </div>
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                {formatCurrency(m.valor)}
                              </td>
                              {periodoAtivo.jaExiste && (
                                <td className="py-2 px-3 text-right font-mono text-amber-800 text-[11px]">
                                  {valorAnterior !== undefined
                                    ? formatCurrency(valorAnterior)
                                    : '—'}
                                </td>
                              )}
                            </tr>
                          )
                        })}

                        {/* Linha de Resultado Final */}
                        <tr className="bg-slate-50/90 font-bold border-t border-slate-200">
                          <td className="py-2.5 px-3 text-slate-900 uppercase text-[11px]">
                            = Lucro ou Prejuízo (Resultado)
                          </td>
                          <td className="py-2.5 px-2 text-center text-slate-400">
                            <ArrowRight className="w-3.5 h-3.5 inline text-blue-600" />
                          </td>
                          <td className="py-2.5 px-3 text-slate-900 font-bold">
                            Lucro Líquido Calculado (LAIR – IR)
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono font-extrabold text-[12px] ${
                              periodoAtivo.lucroOuPrejuizo >= 0
                                ? 'text-emerald-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {formatCurrency(periodoAtivo.lucroOuPrejuizo)}
                          </td>
                          {periodoAtivo.jaExiste && (
                            <td className="py-2.5 px-3 text-right font-mono text-slate-500 text-[11px]">
                              {periodoAtivo.dreExistente
                                ? formatCurrency(
                                    (periodoAtivo.dreExistente.receita_bruta || 0) -
                                      (periodoAtivo.dreExistente.custo_mercadorias || 0) -
                                      (periodoAtivo.dreExistente.despesas_operacionais || 0) -
                                      (periodoAtivo.dreExistente.despesas_financeiras || 0) +
                                      (periodoAtivo.dreExistente.outras_receitas_despesas || 0),
                                  )
                                : '—'}
                            </td>
                          )}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Informação sobre os indicadores */}
              <div className="flex items-center gap-2 p-3 bg-blue-50/60 rounded-lg border border-blue-100 text-blue-900 text-[11px]">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  <strong>Impacto no Sistema:</strong> Assim que confirmada, a DRE oficial do
                  sistema é preenchida. Todos os cálculos de margem líquida, ROE, liquidez,
                  endividamento e múltiplos no Dashboard e relatórios passam a utilizar esses
                  valores apurados automaticamente.
                </span>
              </div>
            </>
          )}
        </div>

        {/* Rodapé com botões de ação */}
        <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between sm:justify-between">
          {resumoFinal ? (
            <div className="w-full flex justify-end">
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8 px-4"
              >
                Concluir e Fechar
              </Button>
            </div>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={salvando}
                className="text-xs text-slate-600 hover:text-slate-900 h-8"
              >
                Cancelar
              </Button>

              <div className="flex items-center gap-2">
                {confirmacaoSobrescrita ? (
                  <Button
                    type="button"
                    onClick={handleConfirmarImportacao}
                    disabled={salvando}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-8 gap-1.5 shadow-xs"
                  >
                    {salvando ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Sobrescrevendo...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Sim, Confirmar e Sobrescrever ({totalPeriodos})
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleConfirmarImportacao}
                    disabled={salvando}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-8 gap-1.5 shadow-xs"
                  >
                    {salvando ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <Database className="w-3.5 h-3.5" />
                        {periodosExistentes > 0
                          ? `Importar para DRE do Sistema (${totalPeriodos})`
                          : `Confirmar e Importar (${totalPeriodos})`}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
