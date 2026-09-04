import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ShieldAlert,
  Search,
  PlusCircle,
  Pencil,
  Trash2,
  Calendar,
  User,
  Building2,
  RefreshCw,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { auditoriaCadastrosService } from '@/services/auditoriaCadastrosService'
import {
  AuditoriaCadastroRecord,
  EntidadeAuditoriaCadastro,
  AcaoAuditoriaCadastro,
} from '@/types/finance'

interface ModalAuditoriaCadastrosProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entidadeInicial?: EntidadeAuditoriaCadastro | 'todas'
}

export const ModalAuditoriaCadastros: React.FC<ModalAuditoriaCadastrosProps> = ({
  open,
  onOpenChange,
  entidadeInicial = 'todas',
}) => {
  const [logs, setLogs] = useState<AuditoriaCadastroRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [filtroEntidade, setFiltroEntidade] = useState<EntidadeAuditoriaCadastro | 'todas'>(
    entidadeInicial,
  )
  const [filtroAcao, setFiltroAcao] = useState<AcaoAuditoriaCadastro | 'todas'>('todas')
  const [busca, setBusca] = useState('')
  const [registroExpandidoId, setRegistroExpandidoId] = useState<string | null>(null)

  const carregarLogs = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await auditoriaCadastrosService.listar({
        entidade: filtroEntidade,
        acao: filtroAcao,
        termoBusca: busca.trim() || undefined,
        perPage: 100,
      })
      setLogs(resp.items)
    } catch (err) {
      console.error('Erro ao carregar auditoria de cadastros:', err)
    } finally {
      setLoading(false)
    }
  }, [filtroEntidade, filtroAcao, busca])

  useEffect(() => {
    if (open) {
      carregarLogs()
    }
  }, [open, carregarLogs])

  const formatDataHora = (iso: string) => {
    if (!iso) return '-'
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const getEntidadeBadge = (entidade: EntidadeAuditoriaCadastro) => {
    switch (entidade) {
      case 'empresas':
        return (
          <Badge className="bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100 flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            Empresas
          </Badge>
        )
      case 'plano_contas':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 flex items-center gap-1">
            <Layers className="w-3 h-3" />
            Plano de Contas
          </Badge>
        )
      case 'users':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 flex items-center gap-1">
            <User className="w-3 h-3" />
            Usuários
          </Badge>
        )
      default:
        return <Badge variant="outline">{entidade}</Badge>
    }
  }

  const getAcaoBadge = (acao: AcaoAuditoriaCadastro) => {
    switch (acao) {
      case 'criacao':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 flex items-center gap-1">
            <PlusCircle className="w-3 h-3" />
            Criação
          </Badge>
        )
      case 'edicao':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 flex items-center gap-1">
            <Pencil className="w-3 h-3" />
            Edição
          </Badge>
        )
      case 'exclusao':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100 flex items-center gap-1">
            <Trash2 className="w-3 h-3" />
            Exclusão
          </Badge>
        )
      default:
        return <Badge variant="outline">{acao}</Badge>
    }
  }

  const contadores = useMemo(() => {
    return {
      total: logs.length,
      criacoes: logs.filter((l) => l.acao === 'criacao').length,
      edicoes: logs.filter((l) => l.acao === 'edicao').length,
      exclusoes: logs.filter((l) => l.acao === 'exclusao').length,
    }
  }, [logs])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-[#0B1F3A]">
                  Trilha de Auditoria dos Cadastros
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Registro cronológico de criação, edição e exclusão de Empresas, Plano de Contas e
                  Usuários
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={carregarLogs}
              disabled={loading}
              className="gap-1 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </DialogHeader>

        {/* Resumo Rápido */}
        <div className="grid grid-cols-4 gap-2 pt-2 pb-1">
          <div className="p-2.5 rounded-lg border bg-slate-50 text-center">
            <p className="text-[10px] font-semibold text-slate-500 uppercase">Total de Ações</p>
            <p className="text-lg font-bold text-[#0B1F3A]">{contadores.total}</p>
          </div>
          <div className="p-2.5 rounded-lg border bg-emerald-50 text-center border-emerald-100">
            <p className="text-[10px] font-semibold text-emerald-700 uppercase">Criações</p>
            <p className="text-lg font-bold text-emerald-800">{contadores.criacoes}</p>
          </div>
          <div className="p-2.5 rounded-lg border bg-blue-50 text-center border-blue-100">
            <p className="text-[10px] font-semibold text-blue-700 uppercase">Edições</p>
            <p className="text-lg font-bold text-blue-800">{contadores.edicoes}</p>
          </div>
          <div className="p-2.5 rounded-lg border bg-red-50 text-center border-red-100">
            <p className="text-[10px] font-semibold text-red-700 uppercase">Exclusões</p>
            <p className="text-lg font-bold text-red-800">{contadores.exclusoes}</p>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="flex flex-col sm:flex-row gap-2 py-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por descrição, usuário, e-mail ou id..."
              className="pl-9 text-xs h-9"
            />
          </div>

          <Select
            value={filtroEntidade}
            onValueChange={(val) => setFiltroEntidade(val as EntidadeAuditoriaCadastro | 'todas')}
          >
            <SelectTrigger className="w-[180px] h-9 text-xs">
              <SelectValue placeholder="Entidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as Entidades</SelectItem>
              <SelectItem value="empresas">Empresas</SelectItem>
              <SelectItem value="plano_contas">Plano de Contas</SelectItem>
              <SelectItem value="users">Usuários</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filtroAcao}
            onValueChange={(val) => setFiltroAcao(val as AcaoAuditoriaCadastro | 'todas')}
          >
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue placeholder="Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as Ações</SelectItem>
              <SelectItem value="criacao">Criação</SelectItem>
              <SelectItem value="edicao">Edição</SelectItem>
              <SelectItem value="exclusao">Exclusão</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lista de Registros */}
        <div className="flex-1 overflow-y-auto border rounded-xl divide-y divide-slate-100 bg-white">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
              <p className="text-xs">Carregando trilha de auditoria...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500">
              <ShieldAlert className="w-10 h-10 text-slate-300 mb-2" />
              <p className="font-semibold text-sm">Nenhum registro de auditoria encontrado</p>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                As ações realizadas nas telas de Empresas, Plano de Contas e Gestão de Usuários
                aparecerão automaticamente nesta linha do tempo.
              </p>
            </div>
          ) : (
            logs.map((log) => {
              const isExpanded = registroExpandidoId === log.id
              const temDetalhes =
                log.detalhes &&
                ((log.detalhes.campos_alterados &&
                  Object.keys(log.detalhes.campos_alterados).length > 0) ||
                  log.detalhes.dados_anteriores ||
                  log.detalhes.dados_novos ||
                  log.detalhes.motivo)

              return (
                <div key={log.id} className="p-3.5 hover:bg-slate-50/70 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {getEntidadeBadge(log.entidade)}
                        {getAcaoBadge(log.acao)}
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" />
                          {formatDataHora(log.created)}
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-[#0B1F3A] break-words">
                        {log.registro_descricao || `ID #${log.registro_id}`}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span className="font-medium text-slate-700">
                            {log.usuario_nome || 'Usuário do Sistema'}
                          </span>
                          {log.usuario_email && (
                            <span className="text-slate-400">({log.usuario_email})</span>
                          )}
                        </span>

                        {log.expand?.empresa && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            {log.expand.empresa.nome}
                          </span>
                        )}
                      </div>
                    </div>

                    {temDetalhes && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRegistroExpandidoId(isExpanded ? null : log.id)}
                        className="h-8 px-2 text-xs text-slate-600 gap-1 shrink-0"
                      >
                        {isExpanded ? (
                          <>
                            Menos <ChevronUp className="w-3 h-3" />
                          </>
                        ) : (
                          <>
                            Antes/Depois <ChevronDown className="w-3 h-3" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Painel Antes / Depois Expandido */}
                  {isExpanded && log.detalhes && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
                      {log.detalhes.motivo && (
                        <p className="text-slate-600">
                          <strong>Observação:</strong> {log.detalhes.motivo}
                        </p>
                      )}

                      {/* Campos alterados lado a lado */}
                      {log.detalhes.campos_alterados &&
                        Object.keys(log.detalhes.campos_alterados).length > 0 && (
                          <div>
                            <p className="font-semibold text-slate-700 mb-1.5">Campos alterados:</p>
                            <div className="space-y-1.5 font-mono text-[11px]">
                              {Object.entries(log.detalhes.campos_alterados).map(
                                ([campo, valores]) => (
                                  <div
                                    key={campo}
                                    className="p-1.5 rounded bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center gap-1 justify-between"
                                  >
                                    <span className="font-bold text-slate-700">{campo}:</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 line-through">
                                        {String(valores.antes ?? 'vazio')}
                                      </span>
                                      <span className="text-slate-400">→</span>
                                      <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 font-semibold">
                                        {String(valores.depois ?? 'vazio')}
                                      </span>
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        )}

                      {/* Snapshot anterior / novo se não houver diff campo a campo */}
                      {(!log.detalhes.campos_alterados ||
                        Object.keys(log.detalhes.campos_alterados).length === 0) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {log.detalhes.dados_anteriores && (
                            <div className="p-2 bg-red-50/50 rounded border border-red-100">
                              <p className="font-semibold text-red-800 mb-1">Dados Anteriores</p>
                              <pre className="text-[10px] text-slate-700 overflow-x-auto">
                                {JSON.stringify(log.detalhes.dados_anteriores, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.detalhes.dados_novos && (
                            <div className="p-2 bg-emerald-50/50 rounded border border-emerald-100">
                              <p className="font-semibold text-emerald-800 mb-1">Dados Novos</p>
                              <pre className="text-[10px] text-slate-700 overflow-x-auto">
                                {JSON.stringify(log.detalhes.dados_novos, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="flex justify-end pt-3 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
