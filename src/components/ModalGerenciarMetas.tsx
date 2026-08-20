import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { metasLancamentosService } from '@/services/financeService'
import type { EmpresaRecord, MetaLancamentoRecord, TipoMetaLancamento } from '@/types/finance'
import { formatBrlMil, formatPercent } from '@/lib/financeCalculations'
import { useToast } from '@/hooks/use-toast'
import {
  Target,
  Plus,
  Trash2,
  Edit2,
  TrendingUp,
  TrendingDown,
  Building2,
  Check,
  Calendar,
} from 'lucide-react'

const MESES = [
  { valor: 1, nome: 'Janeiro' },
  { valor: 2, nome: 'Fevereiro' },
  { valor: 3, nome: 'Março' },
  { valor: 4, nome: 'Abril' },
  { valor: 5, nome: 'Maio' },
  { valor: 6, nome: 'Junho' },
  { valor: 7, nome: 'Julho' },
  { valor: 8, nome: 'Agosto' },
  { valor: 9, nome: 'Setembro' },
  { valor: 10, nome: 'Outubro' },
  { valor: 11, nome: 'Novembro' },
  { valor: 12, nome: 'Dezembro' },
]

interface ModalGerenciarMetasProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresas: EmpresaRecord[]
  metas: MetaLancamentoRecord[]
  selectedEmpresaId?: string
  selectedAno: number
  onMetaChanged: () => void
}

export function ModalGerenciarMetas({
  open,
  onOpenChange,
  empresas,
  metas,
  selectedEmpresaId,
  selectedAno,
  onMetaChanged,
}: ModalGerenciarMetasProps) {
  const { toast } = useToast()

  const [formEmpresa, setFormEmpresa] = useState<string>(
    selectedEmpresaId || (empresas[0]?.id ?? ''),
  )
  const [formTipo, setFormTipo] = useState<TipoMetaLancamento>('Receita')
  const [formValor, setFormValor] = useState<string>('')
  const [formMes, setFormMes] = useState<string>(String(new Date().getMonth() + 1))
  const [formAno, setFormAno] = useState<string>(String(selectedAno || new Date().getFullYear()))
  const [editingMetaId, setEditingMetaId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleOpenEdit = (meta: MetaLancamentoRecord) => {
    setEditingMetaId(meta.id)
    setFormEmpresa(meta.empresa)
    setFormTipo(meta.tipo)
    setFormValor(String(meta.valor))
    setFormMes(String(meta.mes))
    setFormAno(String(meta.ano))
  }

  const handleCancelEdit = () => {
    setEditingMetaId(null)
    setFormValor('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const valorNum = parseFloat(formValor.replace(',', '.'))
    if (!formEmpresa || isNaN(valorNum) || valorNum < 0) {
      toast({
        title: 'Dados inválidos',
        description: 'Preencha a empresa e um valor válido para a meta.',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsSubmitting(true)
      if (editingMetaId) {
        await metasLancamentosService.update(editingMetaId, {
          empresa: formEmpresa,
          tipo: formTipo,
          valor: valorNum,
          mes: Number(formMes),
          ano: Number(formAno),
        })
        toast({
          title: 'Meta atualizada',
          description: 'A meta mensal foi alterada com sucesso.',
        })
        handleCancelEdit()
      } else {
        await metasLancamentosService.create({
          empresa: formEmpresa,
          tipo: formTipo,
          valor: valorNum,
          mes: Number(formMes),
          ano: Number(formAno),
          ativo: true,
        })
        toast({
          title: 'Meta cadastrada',
          description: 'A meta mensal foi criada com sucesso.',
        })
        setFormValor('')
      }
      onMetaChanged()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao salvar meta',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleAtivo = async (id: string, currentAtivo: boolean) => {
    try {
      await metasLancamentosService.toggleAtivo(id, !currentAtivo)
      onMetaChanged()
      toast({
        title: !currentAtivo ? 'Meta ativada' : 'Meta desativada',
        description: `A meta foi ${!currentAtivo ? 'ativada' : 'desativada'} no painel.`,
      })
    } catch (err) {
      toast({
        title: 'Erro ao alterar status',
        description: 'Não foi possível alterar o status da meta.',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta meta?')) return
    try {
      await metasLancamentosService.delete(id)
      onMetaChanged()
      if (editingMetaId === id) handleCancelEdit()
      toast({
        title: 'Meta removida',
        description: 'A meta foi excluída com sucesso.',
      })
    } catch (err) {
      toast({
        title: 'Erro ao excluir meta',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#0B1F3A]">
            <Target className="w-5 h-5 text-blue-600" />
            Metas de Lançamentos Mensais
          </DialogTitle>
          <DialogDescription className="text-xs">
            Defina metas mensais de Receita ou Despesa por empresa para acompanhar o % de
            atingimento em tempo real no Dashboard.
          </DialogDescription>
        </DialogHeader>

        {/* Formulário de Criação / Edição */}
        <form
          onSubmit={handleSubmit}
          className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              {editingMetaId ? (
                <Edit2 className="w-3.5 h-3.5 text-blue-600" />
              ) : (
                <Plus className="w-3.5 h-3.5 text-blue-600" />
              )}
              {editingMetaId ? 'Editar Meta' : 'Nova Meta Mensal'}
            </span>
            {editingMetaId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                className="h-6 text-[11px] text-slate-500 hover:text-slate-800"
              >
                Cancelar Edição
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Empresa */}
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700">Empresa *</Label>
              <Select value={formEmpresa} onValueChange={setFormEmpresa}>
                <SelectTrigger className="h-8 text-xs bg-white">
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id} className="text-xs">
                      {emp.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo */}
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700">Tipo de Conta *</Label>
              <Select
                value={formTipo}
                onValueChange={(val) => setFormTipo(val as TipoMetaLancamento)}
              >
                <SelectTrigger className="h-8 text-xs bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Receita" className="text-xs text-emerald-700 font-semibold">
                    Receita
                  </SelectItem>
                  <SelectItem value="Despesa" className="text-xs text-red-700 font-semibold">
                    Despesa
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Valor */}
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700">Valor da Meta Mensal (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="Ex: 50000"
                value={formValor}
                onChange={(e) => setFormValor(e.target.value)}
                className="h-8 text-xs bg-white"
                required
              />
            </div>

            {/* Mês e Ano */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-700">Mês *</Label>
                <Select value={formMes} onValueChange={setFormMes}>
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map((m) => (
                      <SelectItem key={m.valor} value={String(m.valor)} className="text-xs">
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-700">Ano *</Label>
                <Input
                  type="number"
                  min="2000"
                  max="2100"
                  value={formAno}
                  onChange={(e) => setFormAno(e.target.value)}
                  className="h-8 text-xs bg-white"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              disabled={isSubmitting}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold h-8"
            >
              {editingMetaId ? 'Salvar Alterações' : 'Adicionar Meta'}
            </Button>
          </div>
        </form>

        {/* Lista de Metas Cadastradas */}
        <div className="space-y-2 pt-2">
          <h4 className="text-xs font-bold text-slate-700">Metas Cadastradas ({metas.length})</h4>
          {metas.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              Nenhuma meta cadastrada ainda. Cadastre sua primeira meta acima.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {metas.map((meta) => {
                const empNome =
                  meta.expand?.empresa?.nome ||
                  empresas.find((e) => e.id === meta.empresa)?.nome ||
                  'Empresa'
                const mesNome = MESES.find((m) => m.valor === meta.mes)?.nome || `Mês ${meta.mes}`
                const isAtivo = meta.ativo ?? true

                return (
                  <div
                    key={meta.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                      isAtivo
                        ? 'bg-white border-slate-200 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          meta.tipo === 'Receita'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {meta.tipo === 'Receita' ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[#0B1F3A] truncate">{empNome}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-semibold ${
                              meta.tipo === 'Receita'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            {meta.tipo}
                          </Badge>
                          <span className="text-[11px] text-slate-500">
                            {mesNome}/{meta.ano}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-800 mt-0.5">
                          Meta: {formatBrlMil(meta.valor)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1.5 mr-2">
                        <span className="text-[10px] font-medium text-slate-500">
                          {isAtivo ? 'Ativa' : 'Inativa'}
                        </span>
                        <Switch
                          checked={isAtivo}
                          onCheckedChange={() => handleToggleAtivo(meta.id, isAtivo)}
                        />
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(meta)}
                        className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(meta.id)}
                        className="h-7 w-7 p-0 text-slate-500 hover:text-red-600"
                        title="Excluir"
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

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
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
