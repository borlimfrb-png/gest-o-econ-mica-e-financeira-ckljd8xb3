import React, { useEffect, useState } from 'react'
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
import {
  History,
  Clock,
  User,
  CheckCircle2,
  Calendar,
  ArrowRight,
  RefreshCw,
  PlusCircle,
  Pencil,
  Activity,
} from 'lucide-react'
import { bscService } from '@/services/bscService'
import type {
  BscIniciativaRecord,
  BscIniciativaHistoricoRecord,
  BscHistoricoAcao,
} from '@/types/finance'

export interface ModalHistoricoIniciativaProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  iniciativa: BscIniciativaRecord | null
}

export function ModalHistoricoIniciativa({
  open,
  onOpenChange,
  iniciativa,
}: ModalHistoricoIniciativaProps) {
  const [historico, setHistorico] = useState<BscIniciativaHistoricoRecord[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const carregarHistorico = async () => {
    if (!iniciativa?.id) {
      setHistorico([])
      return
    }

    try {
      setIsLoading(true)
      const list = await bscService.getHistoricoIniciativa(iniciativa.id)
      setHistorico(list)
    } catch (err) {
      console.error('Erro ao carregar histórico da iniciativa:', err)
      setHistorico([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (open && iniciativa?.id) {
      carregarHistorico()
    }
  }, [open, iniciativa?.id])

  const formatarDataHora = (dataStr: string) => {
    try {
      const d = new Date(dataStr)
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch (_) {
      return dataStr
    }
  }

  const getAcaoBadge = (acao: BscHistoricoAcao) => {
    switch (acao) {
      case 'criada':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px] font-bold gap-1">
            <PlusCircle className="w-3 h-3" /> Criada
          </Badge>
        )
      case 'concluida':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold gap-1">
            <CheckCircle2 className="w-3 h-3" /> Concluída
          </Badge>
        )
      case 'status':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] font-bold gap-1">
            <Activity className="w-3 h-3" /> Mudança de Status
          </Badge>
        )
      case 'progresso':
        return (
          <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 text-[10px] font-bold gap-1">
            <Clock className="w-3 h-3" /> Progresso (%)
          </Badge>
        )
      case 'edicao':
      default:
        return (
          <Badge className="bg-slate-100 text-slate-800 border-slate-200 text-[10px] font-bold gap-1">
            <Pencil className="w-3 h-3" /> Edição
          </Badge>
        )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <History className="w-5 h-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                Linha do Tempo e Histórico de Alterações
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Auditoria de quem modificou, quando e antes/depois das alterações no plano de ação.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Resumo da Iniciativa Atual */}
        {iniciativa && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-900 text-sm">{iniciativa.titulo}</span>
              <Badge
                className={`text-[10px] px-2 py-0.5 font-bold ${
                  iniciativa.status === 'concluida'
                    ? 'bg-emerald-100 text-emerald-800'
                    : iniciativa.status === 'em_andamento'
                      ? 'bg-blue-100 text-blue-800'
                      : iniciativa.status === 'planejada'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                }`}
              >
                {iniciativa.status === 'concluida'
                  ? 'Concluída'
                  : iniciativa.status === 'em_andamento'
                    ? 'Em Andamento'
                    : iniciativa.status === 'planejada'
                      ? 'Planejada'
                      : 'Cancelada'}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
              <span>
                <strong>Responsável:</strong> {iniciativa.responsavel || 'Não atribuído'}
              </span>
              <span>·</span>
              <span>
                <strong>Prazo:</strong>{' '}
                {iniciativa.prazo
                  ? new Date(iniciativa.prazo).toLocaleDateString('pt-BR')
                  : 'Sem prazo'}
              </span>
              <span>·</span>
              <span>
                <strong>Progresso Atual:</strong> {iniciativa.progresso ?? 0}%
              </span>
            </div>
          </div>
        )}

        {/* Linha do Tempo */}
        <div className="py-2">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
              <span>Carregando histórico de auditoria...</span>
            </div>
          ) : historico.length === 0 ? (
            <div className="py-10 text-center space-y-2 border border-dashed border-slate-200 rounded-xl p-4">
              <Clock className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-600 font-semibold">
                Nenhum histórico registrado para este plano.
              </p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Modificações futuras de status, progresso, prazo e responsável serão arquivadas
                automaticamente aqui com carimbo de data/hora e autor.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {historico.map((item) => {
                const autor =
                  item.usuario_nome ||
                  item.expand?.usuario?.name ||
                  item.usuario_email ||
                  item.expand?.usuario?.email ||
                  'Usuário do Sistema'

                const temAntesDepois =
                  Boolean(item.dados_anteriores && Object.keys(item.dados_anteriores).length > 0) ||
                  Boolean(item.dados_novos && Object.keys(item.dados_novos).length > 0)

                return (
                  <div key={item.id} className="relative group">
                    {/* Marcador na linha */}
                    <div className="absolute -left-[19px] top-1.5 w-3 h-3 rounded-full bg-blue-600 border-2 border-white ring-2 ring-slate-100 group-hover:bg-blue-700 transition-colors" />

                    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2 hover:border-slate-300 transition-colors">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          {getAcaoBadge(item.acao)}
                          <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            {autor}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatarDataHora(item.created)}
                        </span>
                      </div>

                      {item.descricao && (
                        <p className="text-xs text-slate-700 font-medium">{item.descricao}</p>
                      )}

                      {/* Quadro Comparativo Antes / Depois */}
                      {temAntesDepois && (
                        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 text-[11px] space-y-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                            Detalhamento da Alteração:
                          </span>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {/* Antes */}
                            {item.dados_anteriores && (
                              <div className="bg-white p-2 rounded border border-slate-200 space-y-0.5">
                                <span className="text-[10px] font-semibold text-slate-500 block">
                                  Antes:
                                </span>
                                {Object.entries(item.dados_anteriores).map(([k, v]) => (
                                  <div key={k} className="flex items-baseline gap-1 text-slate-700">
                                    <strong className="capitalize text-slate-600">{k}:</strong>
                                    <span className="font-mono text-slate-500">
                                      {v === null || v === undefined
                                        ? '—'
                                        : typeof v === 'object'
                                          ? JSON.stringify(v)
                                          : String(v)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Depois */}
                            {item.dados_novos && (
                              <div className="bg-blue-50/60 p-2 rounded border border-blue-200 space-y-0.5">
                                <span className="text-[10px] font-semibold text-blue-700 block">
                                  Depois:
                                </span>
                                {Object.entries(item.dados_novos).map(([k, v]) => (
                                  <div key={k} className="flex items-baseline gap-1 text-blue-950">
                                    <strong className="capitalize text-blue-800">{k}:</strong>
                                    <span className="font-mono font-bold">
                                      {v === null || v === undefined
                                        ? '—'
                                        : typeof v === 'object'
                                          ? JSON.stringify(v)
                                          : String(v)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t border-slate-100 flex items-center justify-between sm:justify-between w-full">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={carregarHistorico}
            disabled={isLoading}
            className="text-xs text-slate-600 hover:text-blue-700 gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar Linha do Tempo
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ModalHistoricoIniciativa
