import React, { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  History,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Clock,
  ArrowRight,
  Search,
  Building2,
  Package,
  Layers,
  Filter,
} from 'lucide-react'
import { historicoPrecosService } from '@/services/formacaoPrecoService'
import type { ProdutoRecord, HistoricoPrecoProdutoRecord, EmpresaRecord } from '@/types/finance'
import { useToast } from '@/hooks/use-toast'

export interface ModalHistoricoPrecosProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  produto: ProdutoRecord | null
  empresaAtiva?: EmpresaRecord | null
  empresas?: EmpresaRecord[]
  onPrecoUpdated?: () => void
}

function formatBrl(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
}

function formatPct(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return `${val.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`
}

export function ModalHistoricoPrecos({
  open,
  onOpenChange,
  produto,
  empresaAtiva,
  empresas = [],
  onPrecoUpdated,
}: ModalHistoricoPrecosProps) {
  const { toast } = useToast()
  const [historico, setHistorico] = useState<HistoricoPrecoProdutoRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')
  const [empresaFiltroId, setEmpresaFiltroId] = useState<string>('todas')

  // Identifica a empresa vinculada ao produto atual
  const empresaDoProduto = useMemo(() => {
    if (!produto) return null
    if (produto.expand?.empresa) return produto.expand.empresa
    if (produto.empresa && empresas.length > 0) {
      return empresas.find((e) => e.id === produto.empresa) || null
    }
    return empresaAtiva || null
  }, [produto, empresas, empresaAtiva])

  const loadHistorico = async () => {
    if (!produto?.id) return
    setLoading(true)
    try {
      const list = await historicoPrecosService.getByProduto(produto.id)
      setHistorico(list)
    } catch (err) {
      console.error('Erro ao carregar histórico de preços:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar histórico',
        description: 'Não foi possível carregar as alterações de preço deste produto.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && produto?.id) {
      loadHistorico()
      // Se tiver empresa no produto ou ativa, inicializa
      if (empresaDoProduto?.id) {
        setEmpresaFiltroId(empresaDoProduto.id)
      } else {
        setEmpresaFiltroId('todas')
      }
    } else {
      setHistorico([])
      setSearchFilter('')
    }
  }, [open, produto?.id, empresaDoProduto?.id])

  const historicoFiltrado = useMemo(() => {
    return historico.filter((item) => {
      // Filtro de Busca textual (origem, observação)
      const q = searchFilter.trim().toLowerCase()
      const matchSearch =
        !q ||
        item.origem.toLowerCase().includes(q) ||
        (item.observacao && item.observacao.toLowerCase().includes(q))

      // Filtro de Empresa: se selecionada uma empresa específica no modal, verifica compatibilidade
      let matchEmpresa = true
      if (empresaFiltroId !== 'todas') {
        const itemEmpresaId =
          item.expand?.produto?.empresa ||
          item.expand?.produto?.expand?.empresa?.id ||
          produto?.empresa
        if (itemEmpresaId) {
          matchEmpresa = itemEmpresaId === empresaFiltroId
        }
      }

      return matchSearch && matchEmpresa
    })
  }, [historico, searchFilter, empresaFiltroId, produto])

  // Variação total entre o primeiro registro e o atual
  const stats = useMemo(() => {
    const total = historicoFiltrado.length
    if (total === 0)
      return { total: 0, variacaoAbs: 0, variacaoPct: 0, precoAtual: produto?.preco_venda || 0 }

    const maisRecente = historicoFiltrado[0]
    const maisAntigo = historicoFiltrado[historicoFiltrado.length - 1]
    const precoAtual = maisRecente.preco_novo
    const precoInicial = maisAntigo.preco_anterior ?? maisAntigo.preco_novo

    const variacaoAbs = precoAtual - precoInicial
    const variacaoPct = precoInicial > 0 ? (variacaoAbs / precoInicial) * 100 : 0

    return {
      total,
      variacaoAbs,
      variacaoPct,
      precoAtual,
      precoInicial,
    }
  }, [historicoFiltrado, produto])

  const getBadgeOrigem = (origem: string) => {
    switch (origem) {
      case 'Preço Sugerido Margem':
        return (
          <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
            Sugerido (Margem)
          </Badge>
        )
      case 'Preço Sugerido Markup':
        return (
          <Badge className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200">
            Sugerido (Markup)
          </Badge>
        )
      case 'Cadastro Inicial':
        return (
          <Badge className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200">
            Cadastro Inicial
          </Badge>
        )
      case 'Edição Manual':
      default:
        return (
          <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-700">
            Edição Manual
          </Badge>
        )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[88vh] overflow-y-auto bg-white p-0 gap-0">
        <DialogHeader className="p-5 pb-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-[#0B1F3A]">
                    Histórico de Preços de Venda
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    Registro de todas as alterações de preço praticadas para este produto com
                    identificação da empresa vinculada.
                  </DialogDescription>
                </div>
              </div>
            </div>
            {produto?.codigo && (
              <Badge variant="outline" className="font-mono text-[11px] bg-white">
                {produto.codigo}
              </Badge>
            )}
          </div>

          {/* Dados do Produto Atual e Empresa */}
          {produto && (
            <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-slate-500">Empresa Vinculada:</span>
                  <span className="font-bold text-blue-800">
                    {empresaDoProduto?.nome || 'Não definida'}
                  </span>
                  {empresaDoProduto?.cnpj && (
                    <span className="text-[10px] text-slate-400">({empresaDoProduto.cnpj})</span>
                  )}
                </div>

                {empresas.length > 1 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Filter className="w-3 h-3 text-slate-400" />
                    <span className="text-slate-500 text-[11px]">Filtrar Empresa:</span>
                    <select
                      value={empresaFiltroId}
                      onChange={(e) => setEmpresaFiltroId(e.target.value)}
                      className="h-6 text-[11px] bg-slate-50 border border-slate-200 rounded px-1.5 text-slate-700 font-medium focus:outline-none"
                    >
                      <option value="todas">Todas as empresas</option>
                      {empresas.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-0.5">
                <div>
                  <span className="text-[10px] text-slate-400 block">Produto</span>
                  <span className="font-bold text-slate-900 truncate block" title={produto.nome}>
                    {produto.nome}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Preço Atual</span>
                  <span className="font-bold text-blue-700 block">
                    {formatBrl(produto.preco_venda)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Custo Atual</span>
                  <span className="font-semibold text-slate-700 block">
                    {formatBrl(produto.custo)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Margem Praticada</span>
                  <span className="font-semibold text-emerald-700 block">
                    {formatPct(produto.margem_desejada)}
                  </span>
                </div>
                {produto.capacidade_producao !== undefined &&
                  produto.capacidade_producao !== null &&
                  produto.capacidade_producao > 0 && (
                    <div className="col-span-2 sm:col-span-4 pt-1 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Capacidade de Produção:</span>
                      <span className="font-semibold text-indigo-700">
                        {produto.capacidade_producao.toLocaleString('pt-BR')} {produto.unidade}
                      </span>
                    </div>
                  )}
              </div>
            </div>
          )}
        </DialogHeader>

        <div className="p-5 space-y-4">
          {/* Métricas do Histórico */}
          {historicoFiltrado.length > 0 && (
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <div>
                <span className="text-[10px] text-slate-500 font-medium block">
                  Alterações Registradas
                </span>
                <span className="text-base font-bold text-[#0B1F3A] mt-0.5 block">
                  {stats.total}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-medium block">
                  Variação Total (R$)
                </span>
                <span
                  className={`text-base font-bold mt-0.5 block ${
                    stats.variacaoAbs > 0
                      ? 'text-emerald-700'
                      : stats.variacaoAbs < 0
                        ? 'text-rose-600'
                        : 'text-slate-700'
                  }`}
                >
                  {stats.variacaoAbs > 0 ? '+' : ''}
                  {formatBrl(stats.variacaoAbs)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-medium block">Evolução (%)</span>
                <span
                  className={`text-base font-bold mt-0.5 inline-flex items-center gap-0.5 ${
                    stats.variacaoPct > 0
                      ? 'text-emerald-700'
                      : stats.variacaoPct < 0
                        ? 'text-rose-600'
                        : 'text-slate-700'
                  }`}
                >
                  {stats.variacaoPct > 0 ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : stats.variacaoPct < 0 ? (
                    <TrendingDown className="w-3.5 h-3.5" />
                  ) : (
                    <Minus className="w-3.5 h-3.5" />
                  )}
                  {stats.variacaoPct > 0 ? '+' : ''}
                  {stats.variacaoPct.toFixed(1)}%
                </span>
              </div>
            </div>
          )}

          {/* Campo de Busca no histórico */}
          {historico.length > 2 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Filtrar histórico por origem ou observação..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          )}

          {/* Timeline / Tabela de Histórico */}
          {loading ? (
            <div className="py-12 flex justify-center items-center">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : historicoFiltrado.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                <History className="w-5 h-5" />
              </div>
              <h5 className="text-xs font-semibold text-slate-800">
                {historico.length === 0
                  ? 'Nenhum histórico registrado para este produto'
                  : 'Nenhum registro encontrado no filtro aplicado'}
              </h5>
              <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                {historico.length === 0
                  ? 'As alterações de preço feitas no cadastro ou por vínculo de ficha técnica serão registradas aqui automaticamente com data e hora.'
                  : 'Tente alterar os termos de busca ou o filtro por empresa.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Linha do Tempo de Alterações</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  {historicoFiltrado.length} registro(s)
                </span>
              </div>

              <div className="relative border-l-2 border-slate-200 ml-3.5 space-y-4 pb-2">
                {historicoFiltrado.map((item, index) => {
                  const precoAnt = item.preco_anterior
                  const precoNovo = item.preco_novo
                  const diff =
                    precoAnt !== null && precoAnt !== undefined ? precoNovo - precoAnt : 0
                  const diffPct =
                    precoAnt && precoAnt > 0 ? ((precoNovo - precoAnt) / precoAnt) * 100 : 0
                  const dataFormatada = new Date(item.created).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })

                  // Empresa do registro se expandida
                  const empresaRegistro =
                    item.expand?.produto?.expand?.empresa?.nome || empresaDoProduto?.nome

                  return (
                    <div key={item.id} className="relative pl-6">
                      {/* Ponto na timeline */}
                      <div
                        className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center ${
                          index === 0
                            ? 'border-blue-600 ring-2 ring-blue-100'
                            : diff > 0
                              ? 'border-emerald-500'
                              : diff < 0
                                ? 'border-rose-500'
                                : 'border-slate-400'
                        }`}
                      >
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            index === 0
                              ? 'bg-blue-600'
                              : diff > 0
                                ? 'bg-emerald-500'
                                : diff < 0
                                  ? 'bg-rose-500'
                                  : 'bg-slate-400'
                          }`}
                        />
                      </div>

                      <div className="p-3 bg-slate-50 hover:bg-slate-50/80 border border-slate-200 rounded-lg text-xs space-y-2 transition-colors">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            {getBadgeOrigem(item.origem)}
                            {index === 0 && (
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-100/70 px-1.5 py-0.2 rounded">
                                Atual
                              </span>
                            )}
                            {empresaRegistro && (
                              <span className="text-[10px] text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Building2 className="w-2.5 h-2.5" />
                                {empresaRegistro}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {dataFormatada}
                          </span>
                        </div>

                        {/* Comparativo de Preço Anterior -> Novo */}
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500">De:</span>
                            <span className="font-semibold text-slate-600">
                              {precoAnt !== null && precoAnt !== undefined
                                ? formatBrl(precoAnt)
                                : '—'}
                            </span>
                          </div>

                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />

                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500">Para:</span>
                            <span className="font-bold text-slate-900 text-sm">
                              {formatBrl(precoNovo)}
                            </span>
                          </div>

                          {precoAnt !== null && precoAnt !== undefined && diff !== 0 && (
                            <Badge
                              className={`text-[10px] ml-auto font-semibold ${
                                diff > 0
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {diff > 0 ? '+' : ''}
                              {formatBrl(diff)} ({diffPct > 0 ? '+' : ''}
                              {diffPct.toFixed(1)}%)
                            </Badge>
                          )}
                        </div>

                        {/* Dados adicionais (Custo no momento, Margem, Observações) */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-slate-600 border-t border-slate-200/40">
                          {item.custo_momento !== null && item.custo_momento !== undefined && (
                            <div>
                              <span className="text-slate-400">Custo no momento: </span>
                              <span className="font-medium text-slate-700">
                                {formatBrl(item.custo_momento)}
                              </span>
                            </div>
                          )}
                          {item.margem_nova !== null && item.margem_nova !== undefined && (
                            <div>
                              <span className="text-slate-400">Margem: </span>
                              <span className="font-medium text-emerald-700">
                                {formatPct(item.margem_nova)}
                              </span>
                            </div>
                          )}
                        </div>

                        {item.observacao && (
                          <p className="text-[11px] text-slate-500 italic bg-white p-1.5 rounded border border-slate-200/80">
                            "{item.observacao}"
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
