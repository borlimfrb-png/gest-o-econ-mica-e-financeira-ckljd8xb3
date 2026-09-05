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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { bscService } from '@/services/bscService'
import type { BscKpiRecord, BscIniciativaRecord, BscIniciativaStatus } from '@/types/finance'
import {
  ListTodo,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Flame,
  Sparkles,
  BookOpen,
} from 'lucide-react'
import {
  CATALOGO_MODELOS_PLANOS,
  CATEGORIAS_PROBLEMAS,
  sugerirModelosPorKpi,
  type ModeloPlanoAcao,
  type CategoriaProblemaPlano,
} from '@/lib/catalogoModelosPlanosAcao'

export interface ModalPlanosAcaoBscProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kpi: BscKpiRecord | null
  empresaId: string
  ano: number
  atingimentoPct?: number
  onIniciativasChange?: () => void
  iniciativaInicialParaEditar?: BscIniciativaRecord | null
  listaKpisDisponiveis?: BscKpiRecord[]
}

export function ModalPlanosAcaoBsc({
  open,
  onOpenChange,
  kpi,
  empresaId,
  ano,
  atingimentoPct,
  onIniciativasChange,
  iniciativaInicialParaEditar,
  listaKpisDisponiveis = [],
}: ModalPlanosAcaoBscProps) {
  const { toast } = useToast()

  const [iniciativas, setIniciativas] = useState<BscIniciativaRecord[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isSaving, setIsSaving] = useState<boolean>(false)

  // Formulário de Iniciativa
  const [modalFormOpen, setModalFormOpen] = useState(false)
  const [iniciativaEmEdicao, setIniciativaEmEdicao] = useState<BscIniciativaRecord | null>(null)
  const [iniciativaToDelete, setIniciativaToDelete] = useState<BscIniciativaRecord | null>(null)

  const [formKpiId, setFormKpiId] = useState<string>('')
  const [formTitulo, setFormTitulo] = useState('')
  const [formDescricao, setFormDescricao] = useState('')
  const [formResponsavel, setFormResponsavel] = useState('')
  const [formPrazo, setFormPrazo] = useState('')
  const [formStatus, setFormStatus] = useState<BscIniciativaStatus>('planejada')
  const [formProgresso, setFormProgresso] = useState<string>('0')

  // Catálogo de modelos prontos
  const [filtroCategoriaModelo, setFiltroCategoriaModelo] = useState<string>('todos')
  const [mostrarCatalogoModelos, setMostrarCatalogoModelos] = useState<boolean>(false)

  const kpiAtivo = useMemo(() => {
    if (kpi) return kpi
    if (formKpiId && listaKpisDisponiveis.length > 0) {
      return listaKpisDisponiveis.find((k) => k.id === formKpiId) || null
    }
    return null
  }, [kpi, formKpiId, listaKpisDisponiveis])

  const carregarIniciativas = async () => {
    if (!kpi) return
    try {
      setIsLoading(true)
      const list = await bscService.getIniciativasByKpi(kpi.id)
      setIniciativas(list)
    } catch (err) {
      console.error('Erro ao carregar iniciativas do KPI:', err)
      toast({
        title: 'Erro ao buscar planos de ação',
        description: 'Não foi possível carregar as iniciativas deste KPI.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      if (kpi) {
        carregarIniciativas()
      } else {
        setIniciativas([])
      }

      if (iniciativaInicialParaEditar) {
        handleEditarIniciativa(iniciativaInicialParaEditar)
      }
    } else {
      setIniciativas([])
      setModalFormOpen(false)
    }
  }, [open, kpi?.id, iniciativaInicialParaEditar?.id])

  const handleNovaIniciativa = () => {
    setIniciativaEmEdicao(null)
    setFormKpiId(kpi?.id || (listaKpisDisponiveis[0]?.id ?? ''))
    setFormTitulo('')
    setFormDescricao('')
    setFormResponsavel('')
    // Data padrão: 30 dias a partir de hoje em YYYY-MM-DD
    const d = new Date()
    d.setDate(d.getDate() + 30)
    setFormPrazo(d.toISOString().split('T')[0])
    setFormStatus('planejada')
    setFormProgresso('0')
    setMostrarCatalogoModelos(false)
    setModalFormOpen(true)
  }

  // Modelos recomendados para o KPI atual
  const modelosRecomendados = useMemo(() => {
    if (!kpiAtivo) return CATALOGO_MODELOS_PLANOS.slice(0, 4)
    return sugerirModelosPorKpi(kpiAtivo.nome, kpiAtivo.formula)
  }, [kpiAtivo])

  // Aplicar modelo pronto selecionado
  const handleAplicarModeloPronto = (modelo: ModeloPlanoAcao) => {
    setFormTitulo(modelo.titulo)
    const textoEtapas = modelo.etapasSugeridas.join('\n')
    const textoDescricaoCompleta = `${modelo.descricao}\n\nEtapas Sugeridas:\n${textoEtapas}`
    setFormDescricao(textoDescricaoCompleta)

    // Ajustar prazo conforme sugestão do modelo
    const d = new Date()
    d.setDate(d.getDate() + modelo.prazoSugeridoDias)
    setFormPrazo(d.toISOString().split('T')[0])

    setMostrarCatalogoModelos(false)
    toast({
      title: 'Modelo aplicado com sucesso!',
      description: `O plano foi pré-preenchido com o modelo "${modelo.titulo}". Ajuste o responsável e prazo se desejar.`,
    })
  }

  const handleEditarIniciativa = (ini: BscIniciativaRecord) => {
    setIniciativaEmEdicao(ini)
    setFormKpiId(ini.kpi || kpi?.id || '')
    setFormTitulo(ini.titulo)
    setFormDescricao(ini.descricao || '')
    setFormResponsavel(ini.responsavel || '')
    setFormPrazo(ini.prazo ? ini.prazo.split('T')[0] : '')
    setFormStatus(ini.status)
    setFormProgresso(String(ini.progresso ?? 0))
    setModalFormOpen(true)
  }

  const handleSalvarIniciativa = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetKpiId = formKpiId || kpi?.id || ''
    if (!targetKpiId) {
      toast({
        title: 'KPI obrigatório',
        description: 'Selecione a qual indicador do BSC este plano pertence.',
        variant: 'destructive',
      })
      return
    }

    if (!formTitulo.trim()) {
      toast({
        title: 'Título obrigatório',
        description: 'Informe o que será feito nesta iniciativa.',
        variant: 'destructive',
      })
      return
    }

    const progressoNum = Math.min(100, Math.max(0, Number(formProgresso) || 0))

    setIsSaving(true)
    try {
      const payload = {
        kpi: targetKpiId,
        empresa: empresaId || undefined,
        ano: ano,
        titulo: formTitulo.trim(),
        descricao: formDescricao.trim() || undefined,
        responsavel: formResponsavel.trim() || undefined,
        prazo: formPrazo ? `${formPrazo} 00:00:00.000Z` : undefined,
        status: formStatus,
        progresso: progressoNum,
      }

      if (iniciativaEmEdicao) {
        await bscService.updateIniciativa(iniciativaEmEdicao.id, payload)
        toast({
          title: 'Plano de ação atualizado',
          description: `A iniciativa "${formTitulo}" foi atualizada com sucesso.`,
        })
      } else {
        await bscService.createIniciativa(payload)
        toast({
          title: 'Plano de ação criado',
          description: `A iniciativa "${formTitulo}" foi criada com sucesso.`,
        })
      }

      setModalFormOpen(false)
      if (kpi) {
        await carregarIniciativas()
      }
      onIniciativasChange?.()
    } catch (err) {
      console.error('Erro ao salvar iniciativa:', err)
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível gravar o plano de ação. Verifique os dados.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirmarExclusao = async () => {
    if (!iniciativaToDelete) return
    try {
      await bscService.deleteIniciativa(iniciativaToDelete.id)
      toast({
        title: 'Iniciativa excluída',
        description: `O plano de ação "${iniciativaToDelete.titulo}" foi removido.`,
      })
      setIniciativaToDelete(null)
      await carregarIniciativas()
      onIniciativasChange?.()
    } catch (err) {
      console.error('Erro ao excluir iniciativa:', err)
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir a iniciativa.',
        variant: 'destructive',
      })
    }
  }

  // Rápida alteração de status / conclusão
  const handleAlternarConclusao = async (ini: BscIniciativaRecord) => {
    try {
      const novoStatus: BscIniciativaStatus =
        ini.status === 'concluida' ? 'em_andamento' : 'concluida'
      const novoProgresso = novoStatus === 'concluida' ? 100 : 50
      await bscService.updateIniciativa(ini.id, {
        status: novoStatus,
        progresso: novoProgresso,
      })
      await carregarIniciativas()
      onIniciativasChange?.()
    } catch (err) {
      console.error('Erro ao alternar status da iniciativa:', err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-red-100 text-red-700">
              <Flame className="w-5 h-5" />
            </span>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-[#0B1F3A] flex items-center gap-2">
                Planos de Ação &amp; Iniciativas
                {atingimentoPct !== undefined && (
                  <Badge className="bg-red-100 text-red-800 border-red-200 text-xs font-mono font-bold">
                    🔴 {atingimentoPct}% da meta
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                KPI: <strong className="text-slate-800">{kpi?.nome}</strong> ({kpi?.perspectiva})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Resumo do KPI e Meta */}
        {kpiAtivo && (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-slate-500 block">Objetivo / Descrição:</span>
              <span className="text-slate-800 font-medium">
                {kpiAtivo.descricao || 'Atingir meta pactuada do Balanced Scorecard.'}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-xs font-mono">
                Meta: {kpiAtivo.meta} {kpiAtivo.unidade || ''}
              </Badge>
              <Button
                onClick={handleNovaIniciativa}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold h-8"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Novo Plano de Ação
              </Button>
            </div>
          </div>
        )}

        {/* Lista de Iniciativas Cadastradas */}
        <div className="space-y-2 py-2">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Carregando planos de ação...
            </div>
          ) : iniciativas.length === 0 ? (
            <div className="py-8 text-center space-y-2 border border-dashed border-slate-200 rounded-xl p-4">
              <ListTodo className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-600 font-medium">
                Nenhum plano de ação registrado para este indicador crítico.
              </p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Defina ações corretivas, prazos e responsáveis para recuperar o atingimento deste
                KPI abaixo de 70%.
              </p>
              <Button
                onClick={handleNovaIniciativa}
                size="sm"
                variant="outline"
                className="text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Criar Primeiro Plano de Ação
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {iniciativas.map((ini) => {
                const isConcluida = ini.status === 'concluida'
                const prazoFormatado = ini.prazo
                  ? new Date(ini.prazo).toLocaleDateString('pt-BR')
                  : 'Sem prazo'

                // Verificar se está atrasado
                const hojeStr = new Date().toISOString().split('T')[0]
                const isAtrasado =
                  ini.prazo && ini.prazo.split('T')[0] < hojeStr && ini.status !== 'concluida'

                return (
                  <div
                    key={ini.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isConcluida
                        ? 'bg-slate-50/70 border-slate-200 opacity-80'
                        : isAtrasado
                          ? 'bg-red-50/40 border-red-200'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleAlternarConclusao(ini)}
                          className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                            isConcluida
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-slate-300 hover:border-blue-500 bg-white'
                          }`}
                          title={isConcluida ? 'Marcar em andamento' : 'Marcar como concluída'}
                        >
                          {isConcluida && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>

                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-xs font-bold leading-tight ${
                                isConcluida ? 'line-through text-slate-500' : 'text-slate-900'
                              }`}
                            >
                              {ini.titulo}
                            </span>

                            {/* Badge Status */}
                            <Badge
                              className={`text-[9px] px-1.5 py-0 font-semibold ${
                                ini.status === 'concluida'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  : ini.status === 'em_andamento'
                                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                                    : ini.status === 'planejada'
                                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                                      : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {ini.status === 'concluida'
                                ? 'Concluída'
                                : ini.status === 'em_andamento'
                                  ? 'Em Andamento'
                                  : ini.status === 'planejada'
                                    ? 'Planejada'
                                    : 'Cancelada'}
                            </Badge>

                            {isAtrasado && (
                              <Badge className="bg-red-100 text-red-800 border-red-200 text-[9px] px-1 py-0 font-bold">
                                Atrasada
                              </Badge>
                            )}
                          </div>

                          {ini.descricao && (
                            <p className="text-[11px] text-slate-500 leading-snug">
                              {ini.descricao}
                            </p>
                          )}

                          {/* Metadados: Responsável, Prazo e Progresso */}
                          <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500 flex-wrap">
                            {ini.responsavel && (
                              <span className="flex items-center gap-1 text-slate-700">
                                <User className="w-3 h-3 text-slate-400" />
                                {ini.responsavel}
                              </span>
                            )}
                            <span
                              className={`flex items-center gap-1 font-mono ${
                                isAtrasado ? 'text-red-700 font-semibold' : 'text-slate-600'
                              }`}
                            >
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {prazoFormatado}
                            </span>
                            <span className="font-mono text-slate-700 font-semibold">
                              {ini.progresso ?? 0}%
                            </span>
                          </div>

                          {/* Barra de Progresso */}
                          <div className="w-full pt-1">
                            <Progress value={ini.progresso ?? 0} className="h-1.5" />
                          </div>
                        </div>
                      </div>

                      {/* Ações da Iniciativa */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditarIniciativa(ini)}
                          className="w-7 h-7 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                          title="Editar iniciativa"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIniciativaToDelete(ini)}
                          className="w-7 h-7 text-slate-500 hover:text-red-600 hover:bg-red-50"
                          title="Excluir iniciativa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t border-slate-100">
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

      {/* DIÁLOGO CRUD (NOVA / EDITAR INICIATIVA) */}
      <Dialog open={modalFormOpen} onOpenChange={setModalFormOpen}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <DialogTitle className="text-base font-bold text-[#0B1F3A]">
                  {iniciativaEmEdicao ? 'Editar Plano de Ação' : 'Novo Plano de Ação'}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Vincule ações, prazos e responsáveis para recuperar o indicador{' '}
                  {kpiAtivo?.nome || 'do BSC'}.
                </DialogDescription>
              </div>
              {!iniciativaEmEdicao && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMostrarCatalogoModelos(!mostrarCatalogoModelos)}
                  className={`h-8 text-xs font-semibold gap-1.5 shrink-0 ${
                    mostrarCatalogoModelos
                      ? 'bg-blue-50 text-blue-700 border-blue-300'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  {mostrarCatalogoModelos ? 'Ocultar Modelos' : 'Modelos Prontos'}
                </Button>
              )}
            </div>
          </DialogHeader>

          <form onSubmit={handleSalvarIniciativa} className="space-y-3.5 py-2">
            {/* Bloco de Catálogo de Modelos Prontos */}
            {!iniciativaEmEdicao && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                    Modelos Prontos por Tipo de Problema:
                  </span>
                  <button
                    type="button"
                    onClick={() => setMostrarCatalogoModelos(!mostrarCatalogoModelos)}
                    className="text-[11px] text-blue-600 hover:underline font-medium"
                  >
                    {mostrarCatalogoModelos ? 'Fechar catálogo' : 'Explorar modelos...'}
                  </button>
                </div>

                {/* Sugestões rápidas recomendadas para o KPI */}
                {!mostrarCatalogoModelos && (
                  <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-2.5 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-blue-900 tracking-wider block">
                      💡 Sugestões automáticas para este KPI:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {modelosRecomendados.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleAplicarModeloPronto(m)}
                          className="text-[11px] bg-white border border-blue-200 hover:border-blue-400 hover:bg-blue-50 text-slate-800 rounded-lg px-2 py-1 text-left transition-colors flex items-center gap-1.5 shadow-2xs"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                          <span className="font-medium truncate max-w-[240px]">{m.titulo}</span>
                          <span className="text-[9px] text-blue-600 font-bold shrink-0">Usar</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Painel Completo de Modelos Prontos Classificados por Problema */}
                {mostrarCatalogoModelos && (
                  <div className="border border-blue-200 bg-slate-50/80 rounded-xl p-3 space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-800">
                        Escolha um modelo de plano estruturado:
                      </span>
                      <Select
                        value={filtroCategoriaModelo}
                        onValueChange={(val) => setFiltroCategoriaModelo(val)}
                      >
                        <SelectTrigger className="h-7 text-[11px] w-[180px] bg-white">
                          <SelectValue placeholder="Categoria de Problema" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos" className="text-xs">
                            Todas as Categorias
                          </SelectItem>
                          {CATEGORIAS_PROBLEMAS.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id} className="text-xs">
                              {cat.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                      {CATALOGO_MODELOS_PLANOS.filter(
                        (m) =>
                          filtroCategoriaModelo === 'todos' ||
                          m.categoria === filtroCategoriaModelo,
                      ).map((m) => (
                        <div
                          key={m.id}
                          className="bg-white border border-slate-200 hover:border-blue-300 rounded-lg p-2.5 transition-all text-xs space-y-1.5 shadow-2xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-bold text-slate-900 block">{m.titulo}</span>
                              <Badge
                                variant="outline"
                                className="text-[9px] font-semibold text-blue-700 bg-blue-50 border-blue-200 mt-0.5"
                              >
                                {m.categoriaNome} · Prazo sugerido: {m.prazoSugeridoDias} dias
                              </Badge>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleAplicarModeloPronto(m)}
                              className="h-7 text-[11px] bg-blue-600 hover:bg-blue-700 text-white font-semibold shrink-0"
                            >
                              Aplicar Modelo
                            </Button>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-snug">{m.descricao}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Seletor de KPI se houver lista disponível ou se nenhum kpi foi fixado */}
            {(!kpi || listaKpisDisponiveis.length > 1) && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">KPI Vinculado *</Label>
                <Select
                  value={formKpiId || kpi?.id || ''}
                  onValueChange={(val) => setFormKpiId(val)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione o KPI..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(listaKpisDisponiveis.length > 0
                      ? listaKpisDisponiveis
                      : kpi
                        ? [kpi]
                        : []
                    ).map((item) => (
                      <SelectItem key={item.id} value={item.id} className="text-xs">
                        {item.nome} ({item.perspectiva})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Título da Ação *</Label>
              <Input
                value={formTitulo}
                onChange={(e) => setFormTitulo(e.target.value)}
                placeholder="Ex: Renegociar prazos de pagamento com fornecedores críticos"
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Descrição Detalhada</Label>
              <Textarea
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                placeholder="Passo a passo, escopo, recursos necessários..."
                className="text-xs min-h-[60px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Responsável</Label>
                <Input
                  value={formResponsavel}
                  onChange={(e) => setFormResponsavel(e.target.value)}
                  placeholder="Ex: João Silva / Compras"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Prazo Limite</Label>
                <Input
                  type="date"
                  value={formPrazo}
                  onChange={(e) => setFormPrazo(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Status</Label>
                <Select
                  value={formStatus}
                  onValueChange={(val) => setFormStatus(val as BscIniciativaStatus)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planejada" className="text-xs">
                      🟡 Planejada
                    </SelectItem>
                    <SelectItem value="em_andamento" className="text-xs">
                      🔵 Em Andamento
                    </SelectItem>
                    <SelectItem value="concluida" className="text-xs">
                      🟢 Concluída
                    </SelectItem>
                    <SelectItem value="cancelada" className="text-xs">
                      ⚪ Cancelada
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Progresso (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formProgresso}
                  onChange={(e) => setFormProgresso(e.target.value)}
                  placeholder="0"
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalFormOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                {isSaving ? 'Salvando...' : iniciativaEmEdicao ? 'Salvar' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CONFIRMAÇÃO DE EXCLUSÃO DE INICIATIVA */}
      <AlertDialog
        open={!!iniciativaToDelete}
        onOpenChange={(open) => !open && setIniciativaToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              Excluir este plano de ação?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500">
              Tem certeza que deseja remover a iniciativa{' '}
              <strong className="text-slate-800">{iniciativaToDelete?.titulo}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarExclusao}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
export default ModalPlanosAcaoBsc
