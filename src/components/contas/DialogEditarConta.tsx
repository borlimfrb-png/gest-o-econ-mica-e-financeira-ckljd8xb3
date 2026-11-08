import { useEffect, useMemo, useState } from 'react'
import type {
  ContaRecord,
  CentroRecord,
  TipoConta,
  ClassificacaoDre,
  TipoDespesaRecord,
} from '@/types/finance'
import { CLASSIFICACOES_DRE } from '@/types/finance'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BookOpen,
  GripVertical,
  Pencil,
  Trash2,
  AlertCircle,
  Search,
  FolderOpen,
  ListOrdered,
  Loader2,
} from 'lucide-react'

// Cores do badge por tipo de conta (padrão visual da tela /contas)
export const TIPO_BADGE_CONTA: Record<TipoConta, string> = {
  Ativo: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50',
  Passivo: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50',
  'Patrimônio Líquido': 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-50',
  Receita: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50',
  Despesa: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-50',
}

export const GRUPOS_POR_TIPO: Record<TipoConta, string[]> = {
  Ativo: ['Ativo Circulante', 'Ativo Não Circulante'],
  Passivo: ['Passivo Circulante', 'Passivo Não Circulante'],
  'Patrimônio Líquido': ['Patrimônio Líquido'],
  Receita: ['Receitas Operacionais', 'Outras Receitas'],
  Despesa: ['Despesas Operacionais', 'Despesas Financeiras', 'Outras Despesas'],
}

export interface ContaEdicaoForm {
  nome: string
  tipo: TipoConta
  grupo: string
  centro: string
  descricao: string
  classificacao_dre: ClassificacaoDre | ''
  tipo_despesa?: string
  nao_exibir_dre: boolean
  nao_exibir_fluxo_caixa: boolean
  nao_exibir_em_nada: boolean
}

interface GrupoCentro {
  chave: string // id do centro ou '' (sem centro)
  nome: string
  sequencia: number | null
  contas: ContaRecord[]
}

interface DialogEditarContaProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conta: ContaRecord | null
  contas: ContaRecord[]
  centros: CentroRecord[]
  tiposDespesa?: TipoDespesaRecord[]
  isCliente: boolean
  saving: boolean
  errors: { nome?: string; general?: string }
  form: ContaEdicaoForm
  onFieldChange: (campo: keyof ContaEdicaoForm, valor: any) => void
  onSave: (e: React.FormEvent) => void
  onDelete: (c: ContaRecord) => void
  onSelectConta: (c: ContaRecord) => void
  onReordenar: (
    idsOrdenados: string[],
    movida?: { id: string; centro: string | null },
  ) => Promise<void>
}

const TODOS_TIPOS: TipoConta[] = ['Ativo', 'Passivo', 'Patrimônio Líquido', 'Receita', 'Despesa']

/**
 * Tela grande de edição de conta gerencial (ocupa quase toda a janela):
 * formulário confortável à esquerda e, à direita, a listagem agrupada por
 * centro de custo (na ordem da sequencia) com reordenação por arrastar e soltar.
 */
export function DialogEditarConta({
  open,
  onOpenChange,
  conta,
  contas,
  centros,
  tiposDespesa,
  isCliente,
  saving,
  errors,
  form,
  onFieldChange,
  onSave,
  onDelete,
  onSelectConta,
  onReordenar,
}: DialogEditarContaProps) {
  const { toast } = useToast()
  const podeEditar = !isCliente

  // Ordem otimista (ids) e trocas de centro locais enquanto a gravação viaja
  const [ordemIds, setOrdemIds] = useState<string[] | null>(null)
  const [centroOverride, setCentroOverride] = useState<Record<string, string | null>>({})
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; posicao: 'antes' | 'depois' } | null>(
    null,
  )
  const [busca, setBusca] = useState('')
  const [salvandoOrdem, setSalvandoOrdem] = useState(false)

  // Recarrega (realtime/pós-save): descarta estado otimista
  useEffect(() => {
    setOrdemIds(null)
    setCentroOverride({})
  }, [contas])

  useEffect(() => {
    if (open) {
      setBusca('')
      setDragId(null)
      setDropTarget(null)
    }
  }, [open])

  const buscaTrim = busca.trim().toLowerCase()

  const contasComOverride = useMemo(
    () =>
      contas.map((c) => ({
        ...c,
        centro: c.id in centroOverride ? centroOverride[c.id] : c.centro || null,
      })),
    [contas, centroOverride],
  )

  const contasOrdenadas = useMemo(() => {
    if (!ordemIds) return contasComOverride
    const mapa = new Map(contasComOverride.map((c) => [c.id, c]))
    const fora = contasComOverride.filter((c) => !ordemIds.includes(c.id))
    return [...ordemIds.map((id) => mapa.get(id)).filter(Boolean), ...fora] as ContaRecord[]
  }, [contasComOverride, ordemIds])

  // Agrupa por centro de custo; centros na ordem da sequencia (menor primeiro)
  const grupos = useMemo(() => {
    const base = buscaTrim
      ? contasOrdenadas.filter(
          (c) =>
            c.nome.toLowerCase().includes(buscaTrim) ||
            (c.codigo || '').toLowerCase().includes(buscaTrim),
        )
      : contasOrdenadas
    const mapa = new Map<string, ContaRecord[]>()
    for (const c of base) {
      const k = c.centro || ''
      const arr = mapa.get(k) || []
      arr.push(c)
      mapa.set(k, arr)
    }
    const restantes = new Set(mapa.keys())
    const resultado: GrupoCentro[] = []
    const centrosOrdenados = [...centros].sort(
      (a, b) => (a.sequencia ?? 999999) - (b.sequencia ?? 999999) || a.nome.localeCompare(b.nome),
    )
    for (const centro of centrosOrdenados) {
      if (restantes.has(centro.id)) {
        resultado.push({
          chave: centro.id,
          nome: centro.nome,
          sequencia: centro.sequencia ?? null,
          contas: mapa.get(centro.id) || [],
        })
        restantes.delete(centro.id)
      }
    }
    if (restantes.has('')) {
      resultado.push({
        chave: '',
        nome: 'Sem centro de custo',
        sequencia: null,
        contas: mapa.get('') || [],
      })
    }
    return resultado
  }, [contasOrdenadas, centros, buscaTrim])

  const limparArrasto = () => {
    setDragId(null)
    setDropTarget(null)
  }

  const concluirArrasto = async (alvoId: string, posicao: 'antes' | 'depois') => {
    const origemId = dragId
    limparArrasto()
    if (!origemId || origemId === alvoId) return
    const plano = grupos.flatMap((g) => g.contas)
    const idxOrigem = plano.findIndex((c) => c.id === origemId)
    if (idxOrigem < 0) return
    const movida = plano[idxOrigem]
    const nova = [...plano]
    nova.splice(idxOrigem, 1)
    let idxDestino = nova.findIndex((c) => c.id === alvoId)
    if (idxDestino < 0) return
    if (posicao === 'depois') idxDestino += 1
    nova.splice(idxDestino, 0, movida)
    const ids = nova.map((c) => c.id)
    const grupoAlvo = grupos.find((g) => g.contas.some((c) => c.id === alvoId))
    const centroNovo = grupoAlvo ? grupoAlvo.chave || null : null
    const centroAnterior = movida.centro || null
    const trocouCentro = centroNovo !== centroAnterior

    // Otimista
    setOrdemIds(ids)
    if (trocouCentro) setCentroOverride((p) => ({ ...p, [movida.id]: centroNovo }))

    setSalvandoOrdem(true)
    try {
      await onReordenar(ids, trocouCentro ? { id: movida.id, centro: centroNovo } : undefined)
      toast({
        title: 'Ordem atualizada',
        description: trocouCentro
          ? `"${movida.nome}" movida para o centro "${grupoAlvo?.nome}" e ordem salva.`
          : 'A nova ordem das contas foi salva.',
      })
    } catch (err: any) {
      setOrdemIds(null)
      if (trocouCentro)
        setCentroOverride((p) => {
          const n = { ...p }
          delete n[movida.id]
          return n
        })
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar ordem',
        description: err?.message || 'Não foi possível gravar a nova ordem das contas.',
      })
    } finally {
      setSalvandoOrdem(false)
    }
  }

  const podeArrastar = podeEditar && !buscaTrim && !salvandoOrdem

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1200px] w-[96vw] max-h-[92vh] h-[92vh] bg-white p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-slate-100 shrink-0">
          <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
            <BookOpen className="w-4.5 h-4.5 text-blue-600" />
            Editar Conta {conta?.codigo ? `· ${conta.codigo}` : ''}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Atualize as informações da conta e organize a ordem de exibição por centro de custo. O
            código não pode ser alterado. Campos com * são obrigatórios.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] overflow-y-auto lg:overflow-hidden">
          {/* ============ FORMULÁRIO (ESQUERDA) ============ */}
          <form
            id="form-editar-conta"
            onSubmit={onSave}
            className="px-6 py-5 space-y-4 lg:overflow-y-auto border-r border-slate-100"
          >
            {errors.general && (
              <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800 py-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-xs font-medium">
                  {errors.general}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-conta-codigo" className="text-xs font-semibold text-slate-700">
                  Código
                </Label>
                <Input
                  id="edit-conta-codigo"
                  readOnly
                  value={conta?.codigo || ''}
                  className="h-10 text-sm font-mono font-semibold text-slate-600 bg-slate-50 border-slate-200 cursor-not-allowed"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-conta-nome" className="text-xs font-semibold text-slate-700">
                  Nome *
                </Label>
                <Input
                  id="edit-conta-nome"
                  value={form.nome}
                  onChange={(e) => onFieldChange('nome', e.target.value)}
                  className={`h-10 text-sm ${errors.nome ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
                {errors.nome && (
                  <p className="text-[11px] text-red-600 font-medium">{errors.nome}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-conta-tipo" className="text-xs font-semibold text-slate-700">
                  Tipo *
                </Label>
                <Select
                  value={form.tipo}
                  onValueChange={(val) => onFieldChange('tipo', val as TipoConta)}
                >
                  <SelectTrigger id="edit-conta-tipo" className="h-10 text-sm bg-white">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TODOS_TIPOS.map((t) => (
                      <SelectItem key={t} value={t} className="text-sm">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-conta-grupo" className="text-xs font-semibold text-slate-700">
                  Grupo
                </Label>
                <Select value={form.grupo} onValueChange={(val) => onFieldChange('grupo', val)}>
                  <SelectTrigger id="edit-conta-grupo" className="h-10 text-sm bg-white">
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    {(GRUPOS_POR_TIPO[form.tipo] || []).map((g) => (
                      <SelectItem key={g} value={g} className="text-sm">
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-conta-centro" className="text-xs font-semibold text-slate-700">
                  Centro de Custo
                </Label>
                <Select
                  value={form.centro || 'sem-centro'}
                  onValueChange={(val) => onFieldChange('centro', val === 'sem-centro' ? '' : val)}
                >
                  <SelectTrigger id="edit-conta-centro" className="h-10 text-sm bg-white">
                    <SelectValue placeholder="Sem centro de custo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sem-centro" className="text-sm text-slate-500">
                      Sem centro de custo
                    </SelectItem>
                    {[...centros]
                      .sort(
                        (a, b) =>
                          (a.sequencia ?? 999999) - (b.sequencia ?? 999999) ||
                          a.nome.localeCompare(b.nome),
                      )
                      .map((centro) => (
                        <SelectItem key={centro.id} value={centro.id} className="text-sm">
                          {centro.sequencia != null ? `${centro.sequencia}. ` : ''}
                          {centro.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-400">
                  Define o agrupamento na listagem de ordenação (arrastar também move o centro).
                </p>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-conta-classificacao-dre"
                  className="text-xs font-semibold text-slate-700"
                >
                  Classificação DRE Gerencial
                </Label>
                <Select
                  value={form.classificacao_dre || 'nenhum'}
                  onValueChange={(val) =>
                    onFieldChange('classificacao_dre', val === 'nenhum' ? '' : val)
                  }
                >
                  <SelectTrigger
                    id="edit-conta-classificacao-dre"
                    className="h-10 text-sm bg-white"
                  >
                    <SelectValue placeholder="Selecione a classificação DRE" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum" className="text-sm text-slate-400">
                      (Nenhum / usar heurística automática)
                    </SelectItem>
                    {CLASSIFICACOES_DRE.map((clf) => (
                      <SelectItem key={clf} value={clf} className="text-sm">
                        {clf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {tiposDespesa && tiposDespesa.length > 0 && (
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-conta-tipo-despesa"
                  className="text-xs font-semibold text-slate-700"
                >
                  Tipo de Despesa (Vínculo do Plano de Contas)
                </Label>
                <Select
                  value={form.tipo_despesa || 'nenhum'}
                  onValueChange={(val) =>
                    onFieldChange('tipo_despesa', val === 'nenhum' ? '' : val)
                  }
                >
                  <SelectTrigger id="edit-conta-tipo-despesa" className="h-10 text-sm bg-white">
                    <SelectValue placeholder="Selecione o tipo de despesa (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum" className="text-sm text-slate-400">
                      Nenhum / Não atribuído
                    </SelectItem>
                    {tiposDespesa.map((td) => (
                      <SelectItem key={td.id} value={td.id} className="text-sm">
                        {td.codigo ? `[${td.codigo}] ` : ''}
                        {td.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-400">
                  Associa a conta a uma categoria de despesa fixa ou variável para relatórios
                  gerenciais.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label
                htmlFor="edit-conta-descricao"
                className="text-xs font-semibold text-slate-700"
              >
                Descrição
              </Label>
              <Input
                id="edit-conta-descricao"
                value={form.descricao}
                onChange={(e) => onFieldChange('descricao', e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            {/* Flags de exclusão nos relatórios */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <Label className="text-xs font-semibold text-slate-700 block">
                Exclusões de Relatórios Gerenciais (Flags)
              </Label>
              <div className="space-y-2.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={form.nao_exibir_dre}
                    disabled={form.nao_exibir_em_nada}
                    onChange={(e) => {
                      onFieldChange('nao_exibir_dre', e.target.checked)
                      if (e.target.checked) onFieldChange('nao_exibir_em_nada', false)
                    }}
                    className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4"
                  />
                  <span>Não exibir na DRE Gerencial</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={form.nao_exibir_fluxo_caixa}
                    disabled={form.nao_exibir_em_nada}
                    onChange={(e) => {
                      onFieldChange('nao_exibir_fluxo_caixa', e.target.checked)
                      if (e.target.checked) onFieldChange('nao_exibir_em_nada', false)
                    }}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
                  />
                  <span>Não exibir no Fluxo de Caixa (DRE)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-900 font-semibold pt-1 border-t border-slate-200">
                  <input
                    type="checkbox"
                    checked={form.nao_exibir_em_nada}
                    onChange={(e) => {
                      const val = e.target.checked
                      onFieldChange('nao_exibir_em_nada', val)
                      if (val) {
                        onFieldChange('nao_exibir_dre', false)
                        onFieldChange('nao_exibir_fluxo_caixa', false)
                      }
                    }}
                    className="rounded border-slate-300 text-red-700 focus:ring-red-600 w-4 h-4"
                  />
                  <span className="text-red-700">Não exibir em nada (ambos os relatórios)</span>
                </label>
              </div>
            </div>
          </form>

          {/* ============ LISTAGEM / ORDEM (DIREITA) ============ */}
          <div className="px-6 py-5 space-y-3 lg:overflow-y-auto bg-slate-50/50">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-[#0B1F3A]">
                  Ordem das Contas ({contas.length})
                </h3>
              </div>
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Buscar conta..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="h-8 text-xs pl-8 bg-white"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              {podeEditar
                ? 'Arraste pelo cabo (⋮⋮) para reordenar. Solte sobre outro grupo para mover a conta de centro de custo.'
                : 'Perfil sem permissão de edição: somente visualização.'}
            </p>

            {salvandoOrdem && (
              <div className="flex items-center gap-2 text-[11px] text-blue-700 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando nova ordem...
              </div>
            )}

            <div className="space-y-4">
              {grupos.map((grupo) => (
                <div key={grupo.chave || 'sem-centro'}>
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    <FolderOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-700">{grupo.nome}</span>
                    {grupo.sequencia != null && (
                      <Badge className="text-[9px] bg-white text-slate-500 border-slate-200 font-semibold">
                        ordem {grupo.sequencia}
                      </Badge>
                    )}
                    <span className="text-[10px] text-slate-400">
                      {grupo.contas.length} conta(s)
                    </span>
                  </div>
                  <div className="space-y-1">
                    {grupo.contas.map((c) => (
                      <div
                        key={c.id}
                        onDragOver={(e) => {
                          if (!dragId || dragId === c.id || !podeArrastar) return
                          e.preventDefault()
                          const r = e.currentTarget.getBoundingClientRect()
                          setDropTarget({
                            id: c.id,
                            posicao: e.clientY < r.top + r.height / 2 ? 'antes' : 'depois',
                          })
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          concluirArrasto(
                            c.id,
                            dropTarget?.id === c.id ? dropTarget.posicao : 'antes',
                          )
                        }}
                        onClick={() => {
                          if (podeEditar) onSelectConta(c)
                        }}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border bg-white px-2 py-1.5 transition-all',
                          conta?.id === c.id && 'border-blue-400 ring-1 ring-blue-200',
                          dragId === c.id && 'opacity-40 ring-2 ring-blue-400 bg-blue-50',
                          dropTarget?.id === c.id &&
                            dropTarget.posicao === 'antes' &&
                            'border-t-2 border-t-blue-500',
                          dropTarget?.id === c.id &&
                            dropTarget.posicao === 'depois' &&
                            'border-b-2 border-b-blue-500',
                          podeEditar && 'cursor-pointer hover:border-blue-300 hover:shadow-xs',
                        )}
                      >
                        {podeEditar && (
                          <span
                            draggable={podeArrastar}
                            onDragStart={() => podeArrastar && setDragId(c.id)}
                            onDragEnd={limparArrasto}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              'p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 shrink-0',
                              podeArrastar
                                ? 'cursor-grab active:cursor-grabbing'
                                : 'cursor-not-allowed opacity-50',
                            )}
                            title="Arraste para reordenar a conta"
                          >
                            <GripVertical className="w-4 h-4" />
                          </span>
                        )}
                        <span className="font-mono font-semibold text-[10.5px] text-blue-700 w-16 shrink-0 truncate">
                          {c.codigo || '—'}
                        </span>
                        <span className="text-xs font-semibold text-slate-800 truncate flex-1 min-w-0">
                          {c.nome}
                        </span>
                        <Badge
                          className={cn(
                            'text-[9px] font-semibold px-1.5 py-0 border shrink-0',
                            TIPO_BADGE_CONTA[c.tipo] || '',
                          )}
                        >
                          {c.tipo}
                        </Badge>
                        {c.classificacao_dre && (
                          <Badge className="hidden md:inline-flex text-[9px] font-semibold px-1.5 py-0 border bg-emerald-50 text-emerald-800 border-emerald-200 shrink-0">
                            {c.classificacao_dre}
                          </Badge>
                        )}
                        {c.centro && (
                          <Badge className="hidden xl:inline-flex text-[9px] font-semibold px-1.5 py-0 border bg-slate-100 text-slate-600 border-slate-200 shrink-0">
                            {centros.find((x) => x.id === c.centro)?.nome || 'Centro'}
                          </Badge>
                        )}
                        {podeEditar && (
                          <Pencil className="w-3 h-3 text-slate-300 shrink-0" aria-hidden="true" />
                        )}
                      </div>
                    ))}
                    {grupo.contas.length === 0 && (
                      <p className="text-[11px] text-slate-400 px-2 py-1 italic">
                        Nenhuma conta neste centro.
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {grupos.length === 0 && (
                <p className="text-xs text-slate-500 py-6 text-center">
                  Nenhuma conta encontrada para a busca.
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-3 border-t border-slate-100 gap-2 sm:gap-0 shrink-0 bg-white">
          {podeEditar && conta && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onDelete(conta)}
              disabled={saving || salvandoOrdem}
              className="mr-auto text-xs h-9 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Excluir conta
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="text-xs h-9"
          >
            Cancelar
          </Button>
          {podeEditar && (
            <Button
              type="submit"
              form="form-editar-conta"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
            >
              <Pencil className="w-3.5 h-3.5 mr-1.5" />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
