import React, { useState, useMemo } from 'react'
import type { ContaRecord, TipoConta, CentroRecord, LancamentoCentroRecord } from '@/types/finance'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
  Search,
  BookOpen,
  Filter,
  CheckCircle2,
  X,
  PieChart,
  Layers,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'
import { Link } from 'react-router-dom'

export interface ModalConsultarContasProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contas: ContaRecord[]
  centros: CentroRecord[]
  lancamentos: LancamentoCentroRecord[]
  centroSelecionado?: CentroRecord | null
  onSelecionarContaParaLancamento?: (contaId: string) => void
}

const TIPOS_CONTA: TipoConta[] = ['Ativo', 'Passivo', 'Patrimônio Líquido', 'Receita', 'Despesa']

const TIPO_BADGE_STYLE: Record<TipoConta, string> = {
  Ativo: 'bg-blue-50 text-blue-700 border-blue-200',
  Passivo: 'bg-amber-50 text-amber-700 border-amber-200',
  'Patrimônio Líquido': 'bg-violet-50 text-violet-700 border-violet-200',
  Receita: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Despesa: 'bg-rose-50 text-rose-700 border-rose-200',
}

function formatBrl(val: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
}

export const ModalConsultarContas: React.FC<ModalConsultarContasProps> = ({
  open,
  onOpenChange,
  contas,
  centros,
  lancamentos,
  centroSelecionado,
  onSelecionarContaParaLancamento,
}) => {
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [filtroVinculo, setFiltroVinculo] = useState<'todos' | 'com_lancamento' | 'sem_lancamento'>(
    'todos',
  )
  const [centroFiltroId, setCentroFiltroId] = useState<string>(
    centroSelecionado ? centroSelecionado.id : 'todos',
  )

  // Atualiza centro quando o centroSelecionado muda e o modal abre
  React.useEffect(() => {
    if (open) {
      if (centroSelecionado) {
        setCentroFiltroId(centroSelecionado.id)
      } else {
        setCentroFiltroId('todos')
      }
    }
  }, [open, centroSelecionado])

  const centroAtivo = useMemo(() => {
    if (centroFiltroId === 'todos') return null
    return centros.find((c) => c.id === centroFiltroId) || null
  }, [centros, centroFiltroId])

  // Lançamentos a considerar (ou de todos os centros ou do centro filtrado)
  const lancamentosConsiderados = useMemo(() => {
    if (centroFiltroId === 'todos') return lancamentos
    return lancamentos.filter((l) => l.centro === centroFiltroId)
  }, [lancamentos, centroFiltroId])

  // Estatísticas de uso de cada conta nos lançamentos
  const statsPorConta = useMemo(() => {
    const map = new Map<string, { count: number; total: number; concluidos: number }>()
    for (const l of lancamentosConsiderados) {
      if (!l.conta) continue
      const cur = map.get(l.conta) || { count: 0, total: 0, concluidos: 0 }
      cur.count += 1
      cur.total += Number(l.valor) || 0
      if (l.concluido) cur.concluidos += 1
      map.set(l.conta, cur)
    }
    return map
  }, [lancamentosConsiderados])

  // Resumo por tipo no universo de contas atual
  const contagemPorTipo = useMemo(() => {
    const map: Record<string, number> = {}
    for (const c of contas) {
      map[c.tipo] = (map[c.tipo] || 0) + 1
    }
    return map
  }, [contas])

  // Filtragem das contas
  const contasFiltradas = useMemo(() => {
    let list = contas

    // Filtro por tipo
    if (filtroTipo !== 'todos') {
      list = list.filter((c) => c.tipo === filtroTipo)
    }

    // Filtro por vínculo/lançamento no centro
    if (filtroVinculo === 'com_lancamento') {
      list = list.filter((c) => (statsPorConta.get(c.id)?.count || 0) > 0)
    } else if (filtroVinculo === 'sem_lancamento') {
      list = list.filter((c) => (statsPorConta.get(c.id)?.count || 0) === 0)
    }

    // Busca textual
    const q = busca.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (c) =>
          c.nome.toLowerCase().includes(q) ||
          (c.codigo || '').toLowerCase().includes(q) ||
          (c.grupo || '').toLowerCase().includes(q) ||
          (c.descricao || '').toLowerCase().includes(q),
      )
    }

    // Ordenação: se houver centro com tipo preferido, prioriza contas do mesmo tipo; depois por código
    const tipoPreferido = centroAtivo?.tipo === 'Receita' ? 'Receita' : 'Despesa'
    return [...list].sort((a, b) => {
      if (centroAtivo) {
        const aPref = a.tipo === tipoPreferido ? 0 : 1
        const bPref = b.tipo === tipoPreferido ? 0 : 1
        if (aPref !== bPref) return aPref - bPref
      }
      return (a.codigo || '').localeCompare(b.codigo || '')
    })
  }, [contas, filtroTipo, filtroVinculo, busca, statsPorConta, centroAtivo])

  // Limpar filtros
  const temFiltroAtivo =
    busca.trim() !== '' ||
    filtroTipo !== 'todos' ||
    filtroVinculo !== 'todos' ||
    centroFiltroId !== (centroSelecionado ? centroSelecionado.id : 'todos')

  const handleLimparFiltros = () => {
    setBusca('')
    setFiltroTipo('todos')
    setFiltroVinculo('todos')
    if (centroSelecionado) {
      setCentroFiltroId(centroSelecionado.id)
    } else {
      setCentroFiltroId('todos')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 bg-white overflow-hidden">
        {/* Cabeçalho */}
        <DialogHeader className="p-5 pb-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-[#0B1F3A]">
                  Consulta de Contas Cadastradas
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Verifique e confira as contas cadastradas no sistema e sua vinculação com centros
                  de custo.
                </DialogDescription>
              </div>
            </div>
            <Link
              to="/contas"
              className="text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1 shrink-0 pt-1"
              title="Abrir tela completa de Cadastro de Contas"
            >
              <span>Gerenciar Contas</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Cards de resumo rápido */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-3">
            {TIPOS_CONTA.map((t) => {
              const count = contagemPorTipo[t] || 0
              const isSelected = filtroTipo === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFiltroTipo(isSelected ? 'todos' : t)}
                  className={`text-left p-2 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-blue-50/70 border-blue-300 ring-1 ring-blue-300'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                    {t}
                  </span>
                  <span className="text-sm font-bold text-[#0B1F3A]">{count}</span>
                </button>
              )
            })}
          </div>
        </DialogHeader>

        {/* Barra de Filtros e Busca */}
        <div className="p-4 border-b border-slate-100 bg-white space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            {/* Campo de Busca */}
            <div className="relative sm:col-span-5">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar por código, nome, grupo ou descrição..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9 h-9 text-xs"
                autoFocus
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filtro de Tipo */}
            <div className="sm:col-span-3">
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="h-9 text-xs bg-white">
                  <SelectValue placeholder="Tipo de conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="text-xs">
                    Todos os tipos ({contas.length})
                  </SelectItem>
                  {TIPOS_CONTA.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">
                      {t} ({contagemPorTipo[t] || 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Centro de Custo */}
            <div className="sm:col-span-4">
              <Select value={centroFiltroId} onValueChange={setCentroFiltroId}>
                <SelectTrigger className="h-9 text-xs bg-white">
                  <SelectValue placeholder="Centro de Custo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="text-xs">
                    Todos os centros de custo
                  </SelectItem>
                  {centros.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.codigo || 'CC'} - {c.nome} ({c.tipo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Subfiltro de vínculo e contador */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 flex items-center gap-1 font-medium">
                <Filter className="w-3 h-3 text-slate-400" />
                Vínculo:
              </span>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setFiltroVinculo('todos')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                    filtroVinculo === 'todos'
                      ? 'bg-white text-[#0B1F3A] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroVinculo('com_lancamento')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                    filtroVinculo === 'com_lancamento'
                      ? 'bg-white text-[#0B1F3A] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Com lançamentos ({centroAtivo ? centroAtivo.nome : 'centros'})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroVinculo('sem_lancamento')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                    filtroVinculo === 'sem_lancamento'
                      ? 'bg-white text-[#0B1F3A] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sem lançamentos
                </button>
              </div>

              {temFiltroAtivo && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLimparFiltros}
                  className="h-7 px-2 text-[11px] text-slate-500 hover:text-red-600"
                >
                  <X className="w-3 h-3 mr-1" />
                  Limpar filtros
                </Button>
              )}
            </div>

            <div className="text-slate-500 text-[11px]">
              Exibindo <strong className="text-slate-800">{contasFiltradas.length}</strong> de{' '}
              <strong>{contas.length}</strong> contas cadastradas
            </div>
          </div>
        </div>

        {/* Tabela de Contas com Scroll */}
        <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
          {contasFiltradas.length === 0 ? (
            <div className="py-14 text-center px-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Nenhuma conta encontrada</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {temFiltroAtivo
                  ? 'Nenhum resultado corresponde aos filtros aplicados. Tente ajustar os termos da busca.'
                  : 'Nenhuma conta contábil cadastrada no sistema para a empresa ativa.'}
              </p>
              {temFiltroAtivo ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLimparFiltros}
                  className="mt-3 text-xs h-8"
                >
                  Limpar filtros
                </Button>
              ) : (
                <Link to="/contas" className="inline-block mt-3">
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
                  >
                    Cadastrar Primeira Conta
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 z-10">
                <tr>
                  <th className="py-2.5 px-4 w-28">Código</th>
                  <th className="py-2.5 px-4">Nome da Conta / Grupo</th>
                  <th className="py-2.5 px-4 w-32">Tipo Contábil</th>
                  <th className="py-2.5 px-4 text-center w-32">
                    Lançamentos {centroAtivo ? `(${centroAtivo.codigo || 'CC'})` : ''}
                  </th>
                  <th className="py-2.5 px-4 text-right w-36">Total Movimentado</th>
                  {onSelecionarContaParaLancamento && (
                    <th className="py-2.5 px-4 text-right w-28">Ação</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contasFiltradas.map((c) => {
                  const stats = statsPorConta.get(c.id) || { count: 0, total: 0, concluidos: 0 }
                  const badgeStyle =
                    TIPO_BADGE_STYLE[c.tipo] || 'bg-slate-100 text-slate-700 border-slate-200'

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                        {c.codigo ? (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px]">
                            {c.codigo}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <span>{c.nome}</span>
                          {stats.count > 0 && (
                            <span
                              className="inline-flex items-center text-[10px] text-emerald-600 font-medium"
                              title={`${stats.count} lançamento(s) vinculados`}
                            >
                              <CheckCircle2 className="w-3 h-3 mr-0.5" />
                              em uso
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                          {c.grupo ? (
                            <span className="flex items-center gap-1">
                              <Layers className="w-3 h-3 text-slate-400" />
                              {c.grupo}
                            </span>
                          ) : null}
                          {c.descricao ? (
                            <span className="truncate max-w-xs text-slate-400" title={c.descricao}>
                              · {c.descricao}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold ${badgeStyle}`}
                        >
                          {c.tipo}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {stats.count > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700">
                            {stats.count} {stats.count === 1 ? 'lanç.' : 'lançs.'}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">0 lançamentos</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-800 whitespace-nowrap">
                        {stats.total > 0 ? (
                          <span className="font-bold text-slate-900">{formatBrl(stats.total)}</span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                      {onSelecionarContaParaLancamento && (
                        <td className="py-3 px-4 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              onSelecionarContaParaLancamento(c.id)
                              onOpenChange(false)
                            }}
                            className="h-7 px-2 text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            title="Preencher esta conta no formulário de novo lançamento"
                          >
                            <span>Usar</span>
                            <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Rodapé informativo */}
        <div className="p-3 px-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <PieChart className="w-3.5 h-3.5 text-blue-600" />
            <span>
              {centroAtivo ? (
                <>
                  Verificando contas para o centro{' '}
                  <strong className="text-slate-800">
                    {centroAtivo.codigo || 'CC'} - {centroAtivo.nome}
                  </strong>{' '}
                  ({centroAtivo.tipo})
                </>
              ) : (
                'Verificação global de contas em todos os centros de custo da empresa ativa'
              )}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs bg-white"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
