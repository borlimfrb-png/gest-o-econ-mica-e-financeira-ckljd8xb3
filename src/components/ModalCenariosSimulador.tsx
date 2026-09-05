import React, { useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  BookmarkCheck,
  Plus,
  Trash2,
  Edit2,
  FolderOpen,
  Calendar,
  User,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react'
import { simuladorCenariosService } from '@/services/simuladorCenariosService'
import type { SimuladorCenarioRecord, SimuladorParametrosJson } from '@/types/finance'

export interface ModalCenariosSimuladorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaId: string
  empresaNome: string
  cenarios: SimuladorCenarioRecord[]
  parametrosAtuais: SimuladorParametrosJson
  divisorAtual: number
  onCarregarCenario: (cenario: SimuladorCenarioRecord) => void
  onCenariosChanged: () => void
}

export function ModalCenariosSimulador({
  open,
  onOpenChange,
  empresaId,
  empresaNome,
  cenarios,
  parametrosAtuais,
  divisorAtual,
  onCarregarCenario,
  onCenariosChanged,
}: ModalCenariosSimuladorProps) {
  const { toast } = useToast()

  // Aba / Modo: 'lista' | 'salvar_novo' | 'editar'
  const [modo, setModo] = useState<'lista' | 'salvar_novo' | 'editar'>('lista')

  // Formulário de salvar / editar
  const [nomeCenario, setNomeCenario] = useState('')
  const [descricaoCenario, setDescricaoCenario] = useState('')
  const [cenarioParaEditar, setCenarioParaEditar] = useState<SimuladorCenarioRecord | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Confirmação para sobrescrever
  const [cenarioParaSobrescrever, setCenarioParaSobrescrever] =
    useState<SimuladorCenarioRecord | null>(null)
  const [dialogSobrescreverOpen, setDialogSobrescreverOpen] = useState(false)

  // Confirmação para excluir
  const [cenarioParaExcluir, setCenarioParaExcluir] = useState<SimuladorCenarioRecord | null>(null)
  const [dialogExcluirOpen, setDialogExcluirOpen] = useState(false)

  // Resetar estado quando abrir
  React.useEffect(() => {
    if (open) {
      setModo('lista')
      setNomeCenario('')
      setDescricaoCenario('')
      setCenarioParaEditar(null)
      setCenarioParaSobrescrever(null)
      setCenarioParaExcluir(null)
    }
  }, [open])

  const handleIniciarSalvarNovo = () => {
    setNomeCenario(`Cenário ${new Date().toLocaleDateString('pt-BR')}`)
    setDescricaoCenario('')
    setCenarioParaEditar(null)
    setModo('salvar_novo')
  }

  const handleIniciarEditar = (cenario: SimuladorCenarioRecord) => {
    setCenarioParaEditar(cenario)
    setNomeCenario(cenario.nome)
    setDescricaoCenario(cenario.descricao || '')
    setModo('editar')
  }

  const handleSalvarCenario = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nomeCenario.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe um nome para identificar este cenário de simulação.',
        variant: 'destructive',
      })
      return
    }

    // Se estiver criando novo, verificar se já existe com o mesmo nome para perguntar se deseja sobrescrever
    if (modo === 'salvar_novo') {
      const duplicado = cenarios.find(
        (c) => c.nome.trim().toLowerCase() === nomeCenario.trim().toLowerCase(),
      )
      if (duplicado) {
        setCenarioParaSobrescrever(duplicado)
        setDialogSobrescreverOpen(true)
        return
      }
    }

    await executarGravacao()
  }

  const executarGravacao = async (idSobrescrita?: string) => {
    setIsSubmitting(true)
    try {
      if (modo === 'editar' && cenarioParaEditar) {
        await simuladorCenariosService.atualizar(cenarioParaEditar.id, {
          nome: nomeCenario,
          descricao: descricaoCenario,
        })
        toast({
          title: 'Cenário atualizado com sucesso!',
          description: `As informações do cenário "${nomeCenario}" foram salvas.`,
        })
      } else if (idSobrescrita) {
        // Sobrescrever percentuais e metadados
        await simuladorCenariosService.atualizar(idSobrescrita, {
          nome: nomeCenario,
          descricao: descricaoCenario,
          parametros: parametrosAtuais,
          divisor_calculado: divisorAtual,
        })
        toast({
          title: 'Cenário atualizado!',
          description: `Os percentuais atuais foram gravados sobre o cenário "${nomeCenario}".`,
        })
      } else {
        // Criar novo
        await simuladorCenariosService.criar({
          empresa: empresaId,
          nome: nomeCenario,
          descricao: descricaoCenario,
          parametros: parametrosAtuais,
          divisor_calculado: divisorAtual,
        })
        toast({
          title: 'Cenário salvo com sucesso!',
          description: `O cenário "${nomeCenario}" foi armazenado para a empresa ${empresaNome}.`,
        })
      }

      onCenariosChanged()
      setModo('lista')
      setNomeCenario('')
      setDescricaoCenario('')
      setCenarioParaEditar(null)
      setDialogSobrescreverOpen(false)
      setCenarioParaSobrescrever(null)
    } catch (err: any) {
      console.error('Erro ao salvar cenário:', err)
      toast({
        title: 'Erro ao salvar cenário',
        description: err?.message || 'Não foi possível gravar o cenário no banco de dados.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmarExclusao = async () => {
    if (!cenarioParaExcluir) return
    setIsSubmitting(true)
    try {
      await simuladorCenariosService.excluir(cenarioParaExcluir.id)
      toast({
        title: 'Cenário excluído',
        description: `O cenário "${cenarioParaExcluir.nome}" foi removido com sucesso.`,
      })
      onCenariosChanged()
      setDialogExcluirOpen(false)
      setCenarioParaExcluir(null)
    } catch (err: any) {
      console.error('Erro ao excluir cenário:', err)
      toast({
        title: 'Erro ao excluir cenário',
        description: err?.message || 'Falha ao remover o cenário.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCarregar = (cenario: SimuladorCenarioRecord) => {
    onCarregarCenario(cenario)
    toast({
      title: 'Cenário carregado!',
      description: `Os parâmetros de mark-up de "${cenario.nome}" foram aplicados ao simulador.`,
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
                <span className="p-2 rounded-xl bg-amber-100 text-amber-700">
                  <BookmarkCheck className="w-5 h-5" />
                </span>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    Cenários de Simulação
                    <Badge variant="outline" className="text-xs bg-slate-50 border-slate-200">
                      {empresaNome}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    Salve configurações de mark-up para carregar instantaneamente conforme a
                    estratégia.
                  </DialogDescription>
                </div>
              </div>

              {modo === 'lista' ? (
                <Button
                  size="sm"
                  onClick={handleIniciarSalvarNovo}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Salvar Cenário Atual
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
            {/* MODO LISTA DE CENÁRIOS */}
            {modo === 'lista' && (
              <div className="space-y-3">
                {cenarios.length === 0 ? (
                  <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 p-6">
                    <Sliders className="w-10 h-10 text-slate-400 mx-auto mb-2 opacity-60" />
                    <h4 className="text-sm font-semibold text-slate-800">
                      Nenhum cenário salvo ainda
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                      Você pode salvar a combinação atual de percentuais (prazo, impostos, comissão
                      e margem) para reutilizar quando quiser.
                    </p>
                    <Button
                      size="sm"
                      onClick={handleIniciarSalvarNovo}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Salvar Cenário Atual
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {cenarios.map((cenario) => {
                      const p: Partial<SimuladorParametrosJson> = cenario.parametros || {}
                      const divisor = cenario.divisor_calculado || 0.7
                      const criadoEm = cenario.created
                        ? new Date(cenario.created).toLocaleDateString('pt-BR')
                        : ''
                      const usuarioNome =
                        cenario.expand?.usuario?.name || cenario.expand?.usuario?.email || ''

                      return (
                        <div
                          key={cenario.id}
                          className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-amber-300 hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-slate-900 truncate">
                                {cenario.nome}
                              </h4>
                              <Badge className="bg-amber-100 text-amber-800 border-none font-mono text-[10px] px-2 py-0.5">
                                Divisor: ÷ {divisor.toFixed(4)}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] text-slate-600">
                                Margem: {p.margemLucroPct ?? 0}%
                              </Badge>
                              <Badge variant="outline" className="text-[10px] text-slate-600">
                                Prazo: {p.prazoDias ?? 30}d
                              </Badge>
                            </div>

                            {cenario.descricao && (
                              <p className="text-xs text-slate-600 line-clamp-2">
                                {cenario.descricao}
                              </p>
                            )}

                            <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                              {criadoEm && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" /> {criadoEm}
                                </span>
                              )}
                              {usuarioNome && (
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" /> {usuarioNome}
                                </span>
                              )}
                              <span className="text-slate-500 font-mono text-[10px]">
                                ICMS: {p.icmsPct ?? 0}% · Com.: {p.comissaoPct ?? 0}% · Frete:{' '}
                                {p.fretePct ?? 0}%
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                            <Button
                              size="sm"
                              onClick={() => handleCarregar(cenario)}
                              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1 px-3 shadow-2xs"
                              title="Aplicar percentuais deste cenário no simulador"
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                              Carregar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleIniciarEditar(cenario)}
                              className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900"
                              title="Editar nome ou descrição"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setCenarioParaExcluir(cenario)
                                setDialogExcluirOpen(true)
                              }}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                              title="Excluir cenário"
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
              <form onSubmit={handleSalvarCenario} className="space-y-4">
                <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <Sliders className="w-4 h-4 text-amber-700" />
                    <span>
                      {modo === 'salvar_novo'
                        ? 'Gravação dos Parâmetros Atuais do Simulador'
                        : 'Edição de Dados do Cenário'}
                    </span>
                  </div>
                  <p className="text-amber-800 text-[11px]">
                    {modo === 'salvar_novo'
                      ? `Serão salvos: Prazo (${parametrosAtuais.prazoDias}d), Juros (${parametrosAtuais.jurosMesPct}%), Impostos e Margem de Lucro (${parametrosAtuais.margemLucroPct}%), resultando no divisor ${divisorAtual.toFixed(4)}.`
                      : 'Altere o nome e a descrição para facilitar a identificação da estratégia comercial.'}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Nome do Cenário *</Label>
                  <Input
                    value={nomeCenario}
                    onChange={(e) => setNomeCenario(e.target.value)}
                    placeholder="Ex: Comércio SP 30d, Venda Direta Indústria, Promoção Black Friday..."
                    className="h-9 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Descrição / Contexto Estratégico (Opcional)
                  </Label>
                  <Textarea
                    value={descricaoCenario}
                    onChange={(e) => setDescricaoCenario(e.target.value)}
                    placeholder="Ex: Utilizado para clientes corporativos de São Paulo com prazo de 30 dias e comissão reduzida."
                    className="text-xs min-h-[80px]"
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
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs"
                  >
                    {isSubmitting
                      ? 'Salvando...'
                      : modo === 'editar'
                        ? 'Salvar Alterações'
                        : 'Salvar Cenário'}
                  </Button>
                </div>
              </form>
            )}
          </div>

          <DialogFooter className="border-t pt-3 flex items-center justify-between sm:justify-between">
            <span className="text-[11px] text-slate-400">
              {cenarios.length} cenário(s) cadastrado(s)
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
              Sobrescrever Cenário Existente?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Já existe um cenário com o nome{' '}
              <strong className="text-slate-900">"{cenarioParaSobrescrever?.nome}"</strong>. Deseja
              atualizar os parâmetros deste cenário com os percentuais atuais do simulador?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting} className="text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cenarioParaSobrescrever) {
                  executarGravacao(cenarioParaSobrescrever.id)
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
              Excluir Cenário de Simulação?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Tem certeza que deseja excluir o cenário{' '}
              <strong className="text-slate-900">"{cenarioParaExcluir?.nome}"</strong>? Esta ação
              não poderá ser desfeita.
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
