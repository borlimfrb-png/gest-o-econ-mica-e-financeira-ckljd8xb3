import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  History,
  RotateCw,
  PlusCircle,
  Pencil,
  Trash2,
  Calendar,
  User,
  Search,
  DollarSign,
  Clock,
  ArrowRight,
} from 'lucide-react'
import { auditoriaLancamentosService } from '@/services/auditoriaLancamentosService'
import type { AuditoriaLancamentoRecord, AcaoAuditoriaLancamento } from '@/types/finance'
import { formatCurrency } from '@/lib/financeCalculations'

interface ModalAuditoriaLancamentosProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaId: string
  lancamentoId?: string
  lancamentoDescricao?: string
}

export function ModalAuditoriaLancamentos({
  open,
  onOpenChange,
  empresaId,
  lancamentoId,
  lancamentoDescricao,
}: ModalAuditoriaLancamentosProps) {
  const [logs, setLogs] = useState<AuditoriaLancamentoRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [filtroAcao, setFiltroAcao] = useState<string>('todas')
  const [busca, setBusca] = useState<string>('')

  const carregarLogs = async () => {
    if (!open) return
    setLoading(true)
    try {
      const records = await auditoriaLancamentosService.listar({
        empresaId: empresaId || undefined,
        lancamentoId: lancamentoId || undefined,
        acao: filtroAcao !== 'todas' ? (filtroAcao as AcaoAuditoriaLancamento) : undefined,
      })
      setLogs(records)
    } catch (err) {
      console.error('Erro ao carregar auditoria de lançamentos:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      carregarLogs()
    }
  }, [open, empresaId, lancamentoId, filtroAcao])

  const filteredLogs = logs.filter((item) => {
    if (!busca) return true
    const term = busca.toLowerCase()
    return (
      (item.usuario_nome && item.usuario_nome.toLowerCase().includes(term)) ||
      (item.usuario_email && item.usuario_email.toLowerCase().includes(term)) ||
      (item.historico && item.historico.toLowerCase().includes(term)) ||
      (item.conta_info && item.conta_info.toLowerCase().includes(term)) ||
      (item.lancamento_id && item.lancamento_id.toLowerCase().includes(term))
    )
  })

  const formatDataHora = (dataIso?: string) => {
    if (!dataIso) return '-'
    const d = new Date(dataIso)
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const getAcaoBadge = (acao: AcaoAuditoriaLancamento) => {
    switch (acao) {
      case 'criacao':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs font-semibold gap-1 hover:bg-emerald-100">
            <PlusCircle className="w-3 h-3 text-emerald-600" />
            Criação
          </Badge>
        )
      case 'edicao':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-semibold gap-1 hover:bg-blue-100">
            <Pencil className="w-3 h-3 text-blue-600" />
            Edição
          </Badge>
        )
      case 'exclusao':
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-xs font-semibold gap-1 hover:bg-rose-100">
            <Trash2 className="w-3 h-3 text-rose-600" />
            Exclusão
          </Badge>
        )
      default:
        return <Badge variant="outline">{acao}</Badge>
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <History className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-[#0B1F3A]">
                  Log de Auditoria de Lançamentos
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  {lancamentoId
                    ? `Histórico de alterações do lançamento (${lancamentoDescricao || lancamentoId})`
                    : 'Rastreabilidade de criações, edições e exclusões realizadas pelos usuários nesta empresa.'}
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={carregarLogs}
              disabled={loading}
              className="text-xs h-8 border-slate-200"
            >
              <RotateCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </DialogHeader>

        {/* Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <Input
              placeholder="Buscar por usuário, conta ou histórico..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
          <div>
            <Select value={filtroAcao} onValueChange={setFiltroAcao}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Tipo de Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas" className="text-xs">
                  Todas as ações
                </SelectItem>
                <SelectItem value="criacao" className="text-xs">
                  Apenas Criação
                </SelectItem>
                <SelectItem value="edicao" className="text-xs">
                  Apenas Edição
                </SelectItem>
                <SelectItem value="exclusao" className="text-xs">
                  Apenas Exclusão
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Linha do tempo / Lista */}
        <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-3">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RotateCw className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-xs">Carregando histórico de auditoria...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <History className="w-8 h-8 mx-auto text-slate-400 mb-2 opacity-60" />
              <p className="text-sm font-semibold text-slate-700">Nenhum registro de auditoria</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {busca || filtroAcao !== 'todas'
                  ? 'Nenhum resultado corresponde aos filtros aplicados.'
                  : 'Os lançamentos criados ou alterados serão registrados aqui com data, usuário e detalhes.'}
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const camposAlterados = log.detalhes?.campos_alterados
              const dadosNovos = log.detalhes?.dados_novos
              const dadosAnteriores = log.detalhes?.dados_anteriores

              return (
                <div
                  key={log.id}
                  className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors space-y-2.5 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      {getAcaoBadge(log.acao)}
                      <span className="font-semibold text-slate-800">
                        {log.conta_info || 'Lançamento'}
                      </span>
                      {log.valor !== undefined && (
                        <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {formatCurrency(log.valor)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatDataHora(log.created)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 text-slate-600 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-blue-500" />
                      <span className="font-semibold text-slate-700">
                        {log.usuario_nome || 'Usuário'}
                      </span>
                      {log.usuario_email && (
                        <span className="text-slate-400">({log.usuario_email})</span>
                      )}
                    </div>
                    {log.historico && (
                      <div className="text-slate-600 italic truncate max-w-sm">
                        "{log.historico}"
                      </div>
                    )}
                  </div>

                  {/* Detalhes de campos alterados na edição */}
                  {camposAlterados && Object.keys(camposAlterados).length > 0 && (
                    <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200/70 text-[11px] space-y-1">
                      <p className="font-semibold text-slate-700 text-[10px] uppercase tracking-wider">
                        Campos alterados nesta operação:
                      </p>
                      <div className="space-y-1">
                        {Object.entries(camposAlterados).map(([campo, diff]) => (
                          <div key={campo} className="flex items-center gap-2 text-slate-600">
                            <span className="font-medium text-slate-800 capitalize min-w-[70px]">
                              {campo}:
                            </span>
                            <span className="line-through text-rose-500">
                              {campo === 'valor'
                                ? formatCurrency(diff.antes || 0)
                                : String(diff.antes || '-')}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="font-semibold text-emerald-600">
                              {campo === 'valor'
                                ? formatCurrency(diff.depois || 0)
                                : String(diff.depois || '-')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Detalhes em exclusão */}
                  {log.acao === 'exclusao' && dadosAnteriores && (
                    <div className="bg-rose-50/60 rounded-lg p-2.5 border border-rose-100 text-[11px]">
                      <span className="text-rose-800 font-semibold">Dados excluídos: </span>
                      <span className="text-rose-700">
                        Data: {dadosAnteriores.data ? dadosAnteriores.data.slice(0, 10) : '-'} |
                        Valor: {formatCurrency(dadosAnteriores.valor || 0)} | Histórico:{' '}
                        {dadosAnteriores.historico || '-'}
                      </span>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
