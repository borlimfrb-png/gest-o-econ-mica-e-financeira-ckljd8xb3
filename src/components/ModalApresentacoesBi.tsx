import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  BookmarkCheck,
  Plus,
  Trash2,
  Edit2,
  FolderOpen,
  Calendar,
  Layers,
  Building2,
  EyeOff,
  Maximize2,
  CheckCircle2,
  AlertCircle,
  SlidersHorizontal,
} from 'lucide-react'
import { biApresentacoesService } from '@/services/biApresentacoesService'
import type { BiApresentacaoRecord } from '@/types/finance'

export interface ConfiguracaoAtualBi {
  empresaId?: string
  grupoId?: string
  nomeEntidade: string
  anoBase: number
  anoComparativo: number
  modoConsolidado: boolean
  widgetsOcultos: string[]
  modoApresentacao: boolean
}

export interface ModalApresentacoesBiProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  configAtual: ConfiguracaoAtualBi
  apresentacoes: BiApresentacaoRecord[]
  onCarregarApresentacao: (apresentacao: BiApresentacaoRecord) => void
  onApresentacoesChanged: () => void
}

export function ModalApresentacoesBi({
  open,
  onOpenChange,
  configAtual,
  apresentacoes,
  onCarregarApresentacao,
  onApresentacoesChanged,
}: ModalApresentacoesBiProps) {
  const { toast } = useToast()

  // Modo de exibição: 'lista' | 'salvar_novo' | 'editar'
  const [modo, setModo] = useState<'lista' | 'salvar_novo' | 'editar'>('lista')

  // Formulário de salvar / editar
  const [nomeApresentacao, setNomeApresentacao] = useState('')
  const [apresentacaoParaEditar, setApresentacaoParaEditar] = useState<BiApresentacaoRecord | null>(
    null,
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Confirmação para sobrescrever
  const [apresentacaoParaSobrescrever, setApresentacaoParaSobrescrever] =
    useState<BiApresentacaoRecord | null>(null)
  const [dialogSobrescreverOpen, setDialogSobrescreverOpen] = useState(false)

  // Confirmação para excluir
  const [apresentacaoParaExcluir, setApresentacaoParaExcluir] =
    useState<BiApresentacaoRecord | null>(null)
  const [dialogExcluirOpen, setDialogExcluirOpen] = useState(false)

  // Resetar estado ao abrir
  useEffect(() => {
    if (open) {
      setModo('lista')
      setNomeApresentacao('')
      setApresentacaoParaEditar(null)
      setApresentacaoParaSobrescrever(null)
      setApresentacaoParaExcluir(null)
    }
  }, [open])

  const handleIniciarSalvarNovo = () => {
    setNomeApresentacao(`Apresentação ${configAtual.nomeEntidade} ${configAtual.anoBase}`)
    setApresentacaoParaEditar(null)
    setModo('salvar_novo')
  }

  const handleIniciarEditar = (item: BiApresentacaoRecord) => {
    setApresentacaoParaEditar(item)
    setNomeApresentacao(item.nome)
    setModo('editar')
  }

  const handleSalvarApresentacao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nomeApresentacao.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe um nome para identificar este conjunto de apresentação.',
        variant: 'destructive',
      })
      return
    }

    // Se estiver criando nova, verificar se já existe com o mesmo nome para perguntar se deseja sobrescrever
    if (modo === 'salvar_novo') {
      const duplicado = apresentacoes.find(
        (a) => a.nome.trim().toLowerCase() === nomeApresentacao.trim().toLowerCase(),
      )
      if (duplicado) {
        setApresentacaoParaSobrescrever(duplicado)
        setDialogSobrescreverOpen(true)
        return
      }
    }

    await executarGravacao()
  }

  const executarGravacao = async (idSobrescrita?: string) => {
    setIsSubmitting(true)
    try {
      if (modo === 'editar' && apresentacaoParaEditar) {
        await biApresentacoesService.atualizar(apresentacaoParaEditar.id, {
          nome: nomeApresentacao,
        })
        toast({
          title: 'Apresentação renomeada',
          description: `O nome foi alterado para "${nomeApresentacao}".`,
        })
      } else if (idSobrescrita) {
        // Sobrescrever configuração existente
        await biApresentacoesService.atualizar(idSobrescrita, {
          nome: nomeApresentacao,
          empresa: configAtual.empresaId,
          grupo: configAtual.grupoId,
          ano_base: configAtual.anoBase,
          ano_comparativo: configAtual.anoComparativo,
          modo_consolidado: configAtual.modoConsolidado,
          widgets_ocultos: configAtual.widgetsOcultos,
          modo_apresentacao: configAtual.modoApresentacao,
        })
        toast({
          title: 'Apresentação atualizada!',
          description: `A configuração atual foi sobrescrita em "${nomeApresentacao}".`,
        })
      } else {
        // Criar nova
        await biApresentacoesService.criar({
          nome: nomeApresentacao,
          empresa: configAtual.empresaId,
          grupo: configAtual.grupoId,
          ano_base: configAtual.anoBase,
          ano_comparativo: configAtual.anoComparativo,
          modo_consolidado: configAtual.modoConsolidado,
          widgets_ocultos: configAtual.widgetsOcultos,
          modo_apresentacao: configAtual.modoApresentacao,
        })
        toast({
          title: 'Apresentação salva com sucesso!',
          description: `O conjunto "${nomeApresentacao}" foi gravado e já está disponível.`,
        })
      }

      onApresentacoesChanged()
      setModo('lista')
      setNomeApresentacao('')
      setApresentacaoParaEditar(null)
      setDialogSobrescreverOpen(false)
      setApresentacaoParaSobrescrever(null)
    } catch (err: any) {
      console.error('Erro ao salvar apresentação de BI:', err)
      toast({
        title: 'Erro ao salvar apresentação',
        description: err?.message || 'Não foi possível gravar no servidor.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmarExclusao = async () => {
    if (!apresentacaoParaExcluir) return
    setIsSubmitting(true)
    try {
      await biApresentacoesService.excluir(apresentacaoParaExcluir.id)
      toast({
        title: 'Apresentação excluída',
        description: `O conjunto "${apresentacaoParaExcluir.nome}" foi removido com sucesso.`,
      })
      onApresentacoesChanged()
      setDialogExcluirOpen(false)
      setApresentacaoParaExcluir(null)
    } catch (err: any) {
      console.error('Erro ao excluir apresentação:', err)
      toast({
        title: 'Erro ao excluir apresentação',
        description: err?.message || 'Falha ao remover o registro.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCarregar = (item: BiApresentacaoRecord) => {
    onCarregarApresentacao(item)
    toast({
      title: 'Apresentação carregada!',
      description: `Filtros e visibilidade de "${item.nome}" aplicados ao painel.`,
    })
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl bg-white max-h-[85vh] flex flex-col">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-100 text-blue-700">
                  <BookmarkCheck className="w-5 h-5" />
                </span>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    Apresentações Executivas Salvas
                    <Badge variant="outline" className="text-xs bg-slate-50 border-slate-200">
                      BI Executivo
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    Salve e reaproveite configurações de filtros, anos, visibilidade de widgets e
                    modo apresentação por cliente ou grupo.
                  </DialogDescription>
                </div>
              </div>

              {modo === 'lista' ? (
                <Button
                  size="sm"
                  onClick={handleIniciarSalvarNovo}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Salvar Atual
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setModo('lista')}
                  className="text-xs"
                >
                  Voltar à Lista
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-3 space-y-4">
            {/* MODO LISTA */}
            {modo === 'lista' && (
              <div className="space-y-3">
                {apresentacoes.length === 0 ? (
                  <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 p-6">
                    <SlidersHorizontal className="w-10 h-10 text-slate-400 mx-auto mb-2 opacity-60" />
                    <h4 className="text-sm font-semibold text-slate-800">
                      Nenhuma apresentação salva ainda
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                      Você pode salvar os filtros ativos ({configAtual.nomeEntidade},{' '}
                      {configAtual.anoBase} vs {configAtual.anoComparativo}, widgets ocultos e modo
                      apresentação) para recarregar com um clique em reuniões com clientes.
                    </p>
                    <Button
                      size="sm"
                      onClick={handleIniciarSalvarNovo}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Salvar Configuração Atual
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {apresentacoes.map((item) => {
                      const criadoEm = item.created
                        ? new Date(item.created).toLocaleDateString('pt-BR')
                        : ''
                      const qtdOcultos = Array.isArray(item.widgets_ocultos)
                        ? item.widgets_ocultos.length
                        : 0
                      const entidadeNome =
                        item.expand?.empresa?.nome ||
                        item.expand?.grupo?.nome ||
                        (item.modo_consolidado ? 'Grupo Consolidado' : 'Empresa')

                      return (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-slate-900 truncate">
                                {item.nome}
                              </h4>

                              {/* Badges de Resumo */}
                              <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-semibold text-[10px] px-2 py-0.5">
                                Base: {item.ano_base} vs {item.ano_comparativo}
                              </Badge>

                              {item.modo_consolidado ? (
                                <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] flex items-center gap-1">
                                  <Layers className="w-3 h-3" />
                                  Consolidado
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />
                                  Individual
                                </Badge>
                              )}

                              {qtdOcultos > 0 ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] text-amber-700 bg-amber-50/50 border-amber-200 flex items-center gap-1"
                                >
                                  <EyeOff className="w-3 h-3" />
                                  {qtdOcultos} oculto{qtdOcultos > 1 ? 's' : ''}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] text-slate-600 bg-slate-50"
                                >
                                  Todos visíveis
                                </Badge>
                              )}

                              {item.modo_apresentacao && (
                                <Badge className="bg-slate-800 text-white text-[10px] flex items-center gap-1">
                                  <Maximize2 className="w-3 h-3" />
                                  Tela Cheia
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                              <span className="flex items-center gap-1 text-slate-600 font-medium">
                                <Building2 className="w-3 h-3 text-slate-400" /> {entidadeNome}
                              </span>
                              {criadoEm && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" /> Salvo em {criadoEm}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                            <Button
                              size="sm"
                              onClick={() => handleCarregar(item)}
                              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1 px-3 shadow-2xs"
                              title="Aplicar esta apresentação imediatamente ao painel"
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                              Carregar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleIniciarEditar(item)}
                              className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900"
                              title="Renomear apresentação"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setApresentacaoParaExcluir(item)
                                setDialogExcluirOpen(true)
                              }}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                              title="Excluir apresentação"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* MODO FORMULÁRIO (SALVAR NOVO OU EDITAR) */}
            {(modo === 'salvar_novo' || modo === 'editar') && (
              <form onSubmit={handleSalvarApresentacao} className="space-y-4">
                <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-blue-900">
                    <CheckCircle2 className="w-4 h-4 text-blue-700" />
                    <span>
                      {modo === 'salvar_novo'
                        ? 'Gravação do Conjunto Atual de Apresentação'
                        : 'Renomear Apresentação'}
                    </span>
                  </div>
                  <p className="text-blue-800 text-[11px]">
                    {modo === 'salvar_novo'
                      ? `Serão salvos: Entidade (${configAtual.nomeEntidade}), Exercício Base (${configAtual.anoBase}), Comparativo (${configAtual.anoComparativo}), Modo (${configAtual.modoConsolidado ? 'Consolidado' : 'Individual'}), ${configAtual.widgetsOcultos.length} widget(s) oculto(s) e Tela Cheia (${configAtual.modoApresentacao ? 'Sim' : 'Não'}).`
                      : 'Altere o nome para facilitar a identificação da reunião executiva.'}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Nome da Apresentação *
                  </Label>
                  <Input
                    value={nomeApresentacao}
                    onChange={(e) => setNomeApresentacao(e.target.value)}
                    placeholder="Ex: Reunião Diretoria 2026, Apresentação MOLARE 2026, Comitê Executivo..."
                    className="h-9 text-xs"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setModo('lista')}
                    disabled={isSubmitting}
                    className="text-xs"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
                  >
                    {isSubmitting
                      ? 'Salvando...'
                      : modo === 'editar'
                        ? 'Salvar Alteração'
                        : 'Salvar Apresentação'}
                  </Button>
                </div>
              </form>
            )}
          </div>

          <DialogFooter className="border-t pt-3 flex items-center justify-between sm:justify-between">
            <span className="text-[11px] text-slate-400">
              {apresentacoes.length} apresentação(ões) cadastrada(s)
            </span>
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

      {/* Confirmação de Sobrescrita */}
      <AlertDialog open={dialogSobrescreverOpen} onOpenChange={setDialogSobrescreverOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              Sobrescrever Apresentação Existente?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Já existe uma apresentação com o nome{' '}
              <strong className="text-slate-900">"{apresentacaoParaSobrescrever?.nome}"</strong>.
              Deseja atualizar este conjunto com as configurações de filtros e widgets atualmente
              ativas no painel?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting} className="text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (apresentacaoParaSobrescrever) {
                  executarGravacao(apresentacaoParaSobrescrever.id)
                }
              }}
              disabled={isSubmitting}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            >
              {isSubmitting ? 'Atualizando...' : 'Sim, Sobrescrever'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de Exclusão */}
      <AlertDialog open={dialogExcluirOpen} onOpenChange={setDialogExcluirOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              Excluir Apresentação Salva?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Tem certeza que deseja excluir a apresentação{' '}
              <strong className="text-slate-900">"{apresentacaoParaExcluir?.nome}"</strong>? Esta
              ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting} className="text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarExclusao}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
            >
              {isSubmitting ? 'Excluindo...' : 'Sim, Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
