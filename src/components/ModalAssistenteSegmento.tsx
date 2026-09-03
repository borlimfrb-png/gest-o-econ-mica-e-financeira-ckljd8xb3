import React, { useState, useEffect, useMemo } from 'react'
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
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { planoContasLoteService } from '@/services/planoContasLoteService'
import {
  obterCatalogoRecomendadoPorSegmento,
  type ContaRecomendadaSegmento,
} from '@/lib/catalogoContasSegmento'
import type { EmpresaRecord, PlanoContaRecord, ContaRecord, TipoConta } from '@/types/finance'
import {
  Wand2,
  Sparkles,
  Building2,
  CheckSquare,
  Square,
  Search,
  Filter,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
} from 'lucide-react'

export interface ModalAssistenteSegmentoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedEmpresa: EmpresaRecord | null
  planoAtualEmpresa: PlanoContaRecord[]
  catalogoContas: ContaRecord[]
  onSuccess: () => void
}

const TIPO_CONTA_BADGE: Record<TipoConta, string> = {
  Ativo: 'bg-blue-50 text-blue-700 border-blue-200',
  Passivo: 'bg-amber-50 text-amber-700 border-amber-200',
  'Patrimônio Líquido': 'bg-violet-50 text-violet-700 border-violet-200',
  Receita: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Despesa: 'bg-rose-50 text-rose-700 border-rose-200',
}

function normalizar(str?: string | null): string {
  if (!str) return ''
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export const ModalAssistenteSegmento: React.FC<ModalAssistenteSegmentoProps> = ({
  open,
  onOpenChange,
  selectedEmpresa,
  planoAtualEmpresa,
  catalogoContas,
  onSuccess,
}) => {
  const { toast } = useToast()

  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [apenasPrioritarias, setApenasPrioritarias] = useState(false)

  // Seleção de checkboxes (chaves indexadas por contaNome normalizado)
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())

  // Estado de gravação em lote
  const [gravando, setGravando] = useState(false)
  const [progresso, setProgresso] = useState<{ atual: number; total: number } | null>(null)

  // Mapa de contas já existentes na empresa ativa
  // Usamos lookup no catálogo de contas para comparar pelo nome normalizado
  const nomesContasCadastradasNaEmpresa = useMemo(() => {
    const mapaContaIdParaNome = new Map<string, string>()
    for (const c of catalogoContas) {
      mapaContaIdParaNome.set(c.id, normalizar(c.nome))
    }

    const setNomes = new Set<string>()
    for (const item of planoAtualEmpresa) {
      const nome = mapaContaIdParaNome.get(item.conta)
      if (nome) {
        setNomes.add(nome)
      }
    }
    return setNomes
  }, [planoAtualEmpresa, catalogoContas])

  // Todas as contas recomendadas para o setor da empresa
  const recomendadasSegmento = useMemo(() => {
    return obterCatalogoRecomendadoPorSegmento(selectedEmpresa?.segmento)
  }, [selectedEmpresa?.segmento])

  // Contas que estão FALTANDO na empresa selecionada
  const contasFaltantes = useMemo(() => {
    return recomendadasSegmento.filter((item) => {
      const norm = normalizar(item.contaNome)
      return !nomesContasCadastradasNaEmpresa.has(norm)
    })
  }, [recomendadasSegmento, nomesContasCadastradasNaEmpresa])

  // Inicializa todos os faltantes como marcados ao abrir o modal ou mudar a lista
  useEffect(() => {
    if (!open) return
    const todasChaves = new Set<string>()
    for (const it of contasFaltantes) {
      todasChaves.add(it.contaNome)
    }
    setSelecionadas(todasChaves)
    setBusca('')
    setFiltroTipo('todos')
    setApenasPrioritarias(false)
  }, [open, contasFaltantes])

  // Filtros de busca e tipo
  const contasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return contasFaltantes.filter((item) => {
      if (filtroTipo !== 'todos' && item.contaTipo !== filtroTipo) {
        return false
      }
      if (apenasPrioritarias && item.prioridade !== 'alta') {
        return false
      }
      if (!q) return true
      return (
        item.contaNome.toLowerCase().includes(q) ||
        (item.codigoSugerido || '').toLowerCase().includes(q) ||
        item.contaGrupo.toLowerCase().includes(q) ||
        item.centroNome.toLowerCase().includes(q) ||
        item.motivoRecomendacao.toLowerCase().includes(q)
      )
    })
  }, [contasFaltantes, busca, filtroTipo, apenasPrioritarias])

  const toggleItem = (nome: string) => {
    setSelecionadas((prev) => {
      const next = new Set(prev)
      if (next.has(nome)) {
        next.delete(nome)
      } else {
        next.add(nome)
      }
      return next
    })
  }

  const handleSelecionarTodas = () => {
    const next = new Set(selecionadas)
    for (const item of contasFiltradas) {
      next.add(item.contaNome)
    }
    setSelecionadas(next)
  }

  const handleDesmarcarTodas = () => {
    const next = new Set(selecionadas)
    for (const item of contasFiltradas) {
      next.delete(item.contaNome)
    }
    setSelecionadas(next)
  }

  // Gravação em lote no backend
  const handleAdicionarSelecionadas = async () => {
    if (!selectedEmpresa) {
      toast({
        variant: 'destructive',
        title: 'Selecione uma empresa',
        description: 'É necessário ter uma empresa ativa selecionada para gravar.',
      })
      return
    }

    const itensParaGravar = contasFaltantes.filter((item) => selecionadas.has(item.contaNome))
    if (itensParaGravar.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nenhuma conta selecionada',
        description: 'Marque pelo menos uma conta faltante na lista para adicionar.',
      })
      return
    }

    setGravando(true)
    setProgresso({ atual: 0, total: itensParaGravar.length })

    try {
      const resultado = await planoContasLoteService.aplicarContasSugeridas(
        selectedEmpresa.id,
        itensParaGravar,
        (atual, total) => setProgresso({ atual, total }),
      )

      const partes: string[] = []
      if (resultado.totalCriados > 0) {
        partes.push(`${resultado.totalCriados} nova(s) conta(s) adicionada(s)`)
      }
      if (resultado.totalIgnoradosDuplicados > 0) {
        partes.push(`${resultado.totalIgnoradosDuplicados} já existentes ignoradas`)
      }
      if (resultado.totalErros > 0) {
        partes.push(`${resultado.totalErros} falha(s)`)
      }

      toast({
        title: 'Contas adicionadas com sucesso!',
        description: `Resultado para ${selectedEmpresa.nome}: ${partes.join(', ')}.`,
      })

      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      console.error('Erro ao adicionar contas sugeridas:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao gravar contas',
        description: err?.message || 'Não foi possível gravar as contas sugeridas.',
      })
    } finally {
      setGravando(false)
      setProgresso(null)
    }
  }

  const totalMarcadas = useMemo(() => {
    let count = 0
    for (const it of contasFaltantes) {
      if (selecionadas.has(it.contaNome)) count++
    }
    return count
  }, [contasFaltantes, selecionadas])

  return (
    <Dialog open={open} onOpenChange={gravando ? () => {} : onOpenChange}>
      <DialogContent className="sm:max-w-[820px] max-h-[92vh] flex flex-col bg-white p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                Assistente de Plano de Contas por Segmento
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Identifica e sugere automaticamente contas contábeis e operacionais que estão
                faltando no plano de contas da empresa.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Corpo com scroll */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Banner do Segmento da Empresa Ativa */}
          <div className="p-3.5 bg-violet-50/70 border border-violet-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Building2 className="w-4 h-4 text-violet-700 shrink-0" />
              <div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Empresa Ativa e Segmento
                </span>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <strong className="text-xs text-violet-950 font-bold">
                    {selectedEmpresa?.nome || 'Nenhuma selecionada'}
                  </strong>
                  <Badge className="bg-violet-600 text-white font-medium text-[10px]">
                    Setor: {selectedEmpresa?.segmento || 'Serviços'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className="bg-white text-slate-700 border-slate-200 font-mono"
              >
                {planoAtualEmpresa.length} existente(s)
              </Badge>
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold"
              >
                {contasFaltantes.length} faltante(s)
              </Badge>
            </div>
          </div>

          {/* Estado: quando o plano já tem todas as contas */}
          {contasFaltantes.length === 0 ? (
            <div className="p-8 text-center space-y-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <h3 className="text-sm font-bold text-emerald-950">
                Plano de Contas Completo para este Segmento!
              </h3>
              <p className="text-xs text-emerald-800 max-w-md mx-auto">
                A empresa <strong className="font-semibold">{selectedEmpresa?.nome}</strong> já
                possui todas as contas recomendadas para o segmento de{' '}
                {selectedEmpresa?.segmento || 'atuação'}.
              </p>
            </div>
          ) : (
            <>
              {/* Controles de Filtro, Selecionar/Desmarcar */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
                  <div className="relative flex-1 w-full">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <Input
                      placeholder="Buscar por conta, centro ou recomendação..."
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      className="h-8 text-xs pl-8 bg-white"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select
                      value={filtroTipo}
                      onChange={(e) => setFiltroTipo(e.target.value)}
                      className="h-8 text-xs bg-white border border-slate-200 rounded-md px-2 text-slate-700 font-medium focus:ring-1 focus:ring-violet-600"
                    >
                      <option value="todos">Todos os tipos</option>
                      <option value="Ativo">Ativo</option>
                      <option value="Passivo">Passivo</option>
                      <option value="Patrimônio Líquido">Patrimônio Líquido</option>
                      <option value="Receita">Receita</option>
                      <option value="Despesa">Despesa</option>
                    </select>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setApenasPrioritarias(!apenasPrioritarias)}
                      className={`h-8 text-xs font-semibold gap-1.5 shrink-0 ${
                        apenasPrioritarias
                          ? 'bg-violet-50 text-violet-800 border-violet-300'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                      Setor Prioritário
                    </Button>
                  </div>
                </div>

                {/* Linha de seleção rápida */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleSelecionarTodas}
                      className="h-7 text-[11px] text-blue-700 hover:bg-blue-50 px-2 gap-1"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      Marcar todas filtradas
                    </Button>
                    <span className="text-slate-300">|</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleDesmarcarTodas}
                      className="h-7 text-[11px] text-slate-600 hover:bg-slate-100 px-2 gap-1"
                    >
                      <Square className="w-3.5 h-3.5" />
                      Desmarcar todas
                    </Button>
                  </div>

                  <span className="text-[11px] font-semibold text-slate-600">
                    {totalMarcadas} de {contasFaltantes.length} selecionada(s)
                  </span>
                </div>
              </div>

              {/* Tabela de Contas Faltantes com Checkboxes */}
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[310px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200">
                    <tr className="text-slate-600 font-semibold text-[11px]">
                      <th className="py-2 px-3 w-8">{/* checkbox header opcional */}</th>
                      <th className="py-2 px-2 w-16">Código</th>
                      <th className="py-2 px-3">Conta Sugerida</th>
                      <th className="py-2 px-3">Tipo / Centro</th>
                      <th className="py-2 px-3">Motivo / Aderência ao Setor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {contasFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          Nenhuma conta correspondente aos filtros.
                        </td>
                      </tr>
                    ) : (
                      contasFiltradas.map((item, idx) => {
                        const marcada = selecionadas.has(item.contaNome)
                        const isPrioritaria = item.prioridade === 'alta'

                        return (
                          <tr
                            key={idx}
                            onClick={() => toggleItem(item.contaNome)}
                            className={`cursor-pointer transition-colors ${
                              marcada
                                ? 'bg-violet-50/40 hover:bg-violet-50/70'
                                : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <td
                              className="py-2 px-3 text-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Checkbox
                                checked={marcada}
                                onCheckedChange={() => toggleItem(item.contaNome)}
                              />
                            </td>

                            <td className="py-2 px-2 font-mono text-slate-500 font-semibold text-[11px]">
                              {item.codigoSugerido || '—'}
                            </td>

                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <strong className="text-slate-900 font-semibold">
                                  {item.contaNome}
                                </strong>
                                {isPrioritaria && (
                                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[9px] px-1 py-0 font-bold">
                                    ★ Setor
                                  </Badge>
                                )}
                              </div>
                              {item.descricao && (
                                <span className="text-[10px] text-slate-500 block truncate max-w-xs mt-0.5">
                                  {item.descricao}
                                </span>
                              )}
                            </td>

                            <td className="py-2 px-3">
                              <div className="flex flex-col gap-0.5">
                                <Badge
                                  className={`text-[9px] font-semibold px-1.5 py-0 border w-fit ${
                                    TIPO_CONTA_BADGE[item.contaTipo] || ''
                                  }`}
                                >
                                  {item.contaTipo}
                                </Badge>
                                <span className="text-[10px] text-slate-500">
                                  {item.centroNome}
                                </span>
                              </div>
                            </td>

                            <td className="py-2 px-3 text-slate-600 max-w-[240px]">
                              <p className="text-[11px] leading-tight text-slate-700">
                                {item.motivoRecomendacao}
                              </p>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Barra de Progresso durante gravação */}
              {progresso && (
                <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg space-y-1.5 animate-fadeIn">
                  <div className="flex justify-between text-xs font-semibold text-violet-900">
                    <span>Adicionando contas ao plano da empresa...</span>
                    <span>
                      {progresso.atual} de {progresso.total} (
                      {Math.round((progresso.atual / progresso.total) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-violet-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-violet-600 h-2 rounded-full transition-all duration-150"
                      style={{
                        width: `${Math.round((progresso.atual / progresso.total) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-violet-600" />
            <span>
              Contas adicionadas recebem código automático isolado (ex: PC-001) para a empresa
              ativa.
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={gravando}
              className="text-xs h-9"
            >
              Cancelar
            </Button>

            {contasFaltantes.length > 0 && (
              <Button
                type="button"
                onClick={handleAdicionarSelecionadas}
                disabled={gravando || totalMarcadas === 0}
                className="text-xs h-9 font-semibold bg-violet-600 hover:bg-violet-700 text-white shadow-xs gap-1.5"
              >
                {gravando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adicionando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Adicionar Contas Selecionadas ({totalMarcadas})
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
