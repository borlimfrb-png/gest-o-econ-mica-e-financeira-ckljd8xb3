import React, { useState, useEffect, useMemo } from 'react'
import { useToast } from '@/hooks/use-toast'
import { lancamentosService } from '@/services/financeService'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import { SeletorPlanoContaCombobox } from '@/components/SeletorPlanoContaCombobox'
import { gerarListaMeses } from '@/lib/dreGerencialTypes'
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
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle, Calendar, DollarSign, History, Pencil } from 'lucide-react'
import {
  formatarValorBrlInput,
  parseValorBrl,
  type LancamentoVariavelItem,
} from '@/lib/lancamentosVariaveisHelper'

export interface ModalAjusteDespesaVariavelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: LancamentoVariavelItem | null
  contas: ContaRecord[]
  planoContas: PlanoContaRecord[]
  /** Empresa fixa do contexto ativo (obrigatória: isolamento multi-tenant). */
  empresaId: string
  /** Ano do contexto da análise — usado para limitar a competência ajustável. */
  anoContexto: number
  onAjustado: () => void
}

export function ModalAjusteDespesaVariavel({
  open,
  onOpenChange,
  item,
  contas,
  planoContas,
  empresaId,
  anoContexto,
  onAjustado,
}: ModalAjusteDespesaVariavelProps) {
  const { toast } = useToast()

  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [valorInput, setValorInput] = useState('')
  const [data, setData] = useState('')
  const [historico, setHistorico] = useState('')
  const [planoContaId, setPlanoContaId] = useState('')

  const lancamento = item?.lancamento

  // Lista de competências possíveis (todos os meses do ano de contexto)
  const competencias = useMemo(() => gerarListaMeses(anoContexto, 1, 12), [anoContexto])

  useEffect(() => {
    if (open && lancamento) {
      setValorInput(formatarValorBrlInput(lancamento.valor))
      setData((lancamento.data || '').slice(0, 10))
      setHistorico(lancamento.historico || '')
      setPlanoContaId(lancamento.plano_conta || '')
      setErro('')
    }
  }, [open, lancamento])

  // Só contas da empresa ativa (isolamento multi-tenant)
  const planoContasEmpresa = useMemo(
    () => planoContas.filter((p) => p.empresa === empresaId),
    [planoContas, empresaId],
  )

  const competenciaMes = useMemo(() => {
    if (!data) return null
    const chave = data.slice(0, 7)
    return competencias.find((m) => m.chave === chave) || null
  }, [data, competencias])

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lancamento || !item) return

    // Validações
    const valor = parseValorBrl(valorInput)
    if (valor === null || valor <= 0) {
      setErro('Informe um valor válido maior que zero.')
      return
    }
    if (!data || data.length !== 10) {
      setErro('Informe a data de competência do lançamento.')
      return
    }
    if (competenciaMes === null) {
      setErro(
        `A competência deve estar dentro do exercício ${anoContexto} para manter a análise consistente.`,
      )
      return
    }
    if (!planoContaId) {
      setErro('Selecione a conta do plano de contas do lançamento.')
      return
    }
    if (!empresaId) {
      setErro('Nenhuma empresa ativa definida para o ajuste.')
      return
    }

    setSaving(true)
    setErro('')
    try {
      // Detecção de mudança de competência: se sair do mês original, cria
      // novo lançamento no mês de destino e exclui o original (movimentação).
      const mesOriginal = (lancamento.data || '').slice(0, 7)
      const mesNovo = data.slice(0, 7)
      const mudouCompetencia = mesOriginal !== mesNovo

      if (mudouCompetencia) {
        const criado = await lancamentosService.create({
          empresa: empresaId,
          plano_conta: planoContaId,
          data,
          valor,
          historico: historico.trim() || item.contaNome,
        })
        await lancamentosService.delete(lancamento.id)
        try {
          toast({
            title: 'Despesa variável ajustada',
            description: `Lançamento movimentado de ${mesOriginal} para ${mesNovo} (${criado.id.slice(
              0,
              8,
            )}…) e registrado na auditoria.`,
          })
        } catch {
          /* toast opcional */
        }
      } else {
        await lancamentosService.update(lancamento.id, {
          empresa: empresaId,
          plano_conta: planoContaId,
          data,
          valor,
          historico: historico.trim() || undefined,
        })
      }

      toast({
        title: mudouCompetencia ? 'Despesa variável remanejada' : 'Despesa variável ajustada',
        description: `Valores atualizados e auditados na empresa ativa. Os indicadores foram recalculados.`,
      })
      onOpenChange(false)
      onAjustado()
    } catch (err: any) {
      console.error('Erro ao ajustar despesa variável:', err)
      setErro(err?.message || 'Falha ao gravar o ajuste no banco de dados.')
      toast({
        variant: 'destructive',
        title: 'Erro no ajuste',
        description: err?.message || 'Não foi possível gravar o ajuste da despesa variável.',
      })
    } finally {
      setSaving(false)
    }
  }

  const valorOriginal = lancamento?.valor || 0
  const valorNovo = parseValorBrl(valorInput)
  const deltaValor = valorNovo !== null ? valorNovo - valorOriginal : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-white">
        <form onSubmit={handleSalvar}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
              <Pencil className="w-4 h-4 text-amber-600" />
              Ajuste Individual de Despesa Variável
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Edita o lançamento real do banco (coleção lancamentos). A alteração é registrada na
              auditoria e recalcula os indicadores da simulação.
            </DialogDescription>
          </DialogHeader>

          {erro && (
            <Alert
              variant="destructive"
              className="mt-3 bg-red-50 border-red-200 text-red-800 py-2"
            >
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-xs font-medium">{erro}</AlertDescription>
            </Alert>
          )}

          {lancamento && (
            <div className="space-y-3 py-4">
              {/* Conta atual — resumo */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                    Conta Classificada
                  </p>
                  <p className="text-xs font-bold text-[#0B1F3A] truncate">
                    {item?.contaCodigo ? `${item.contaCodigo} · ` : ''}
                    {item?.contaNome}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="text-[9.5px] shrink-0 bg-amber-50 text-amber-800 border-amber-200"
                >
                  Despesa Variável DRE
                </Badge>
              </div>

              {/* Valor */}
              <div className="space-y-1.5">
                <Label htmlFor="aj-var-valor" className="text-xs font-semibold text-slate-700">
                  Valor da Despesa (R$) *
                </Label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <Input
                    id="aj-var-valor"
                    type="text"
                    inputMode="decimal"
                    value={valorInput}
                    onChange={(e) => setValorInput(e.target.value)}
                    placeholder="0,00"
                    className="h-9 text-xs pl-8 font-semibold text-slate-900 font-mono"
                  />
                </div>
                {deltaValor !== null && deltaValor !== 0 && (
                  <p
                    className={`text-[10.5px] font-semibold ${
                      deltaValor > 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {deltaValor > 0 ? 'Aumento de ' : 'Redução de '}
                    {Math.abs(deltaValor).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </p>
                )}
              </div>

              {/* Competência */}
              <div className="space-y-1.5">
                <Label htmlFor="aj-var-data" className="text-xs font-semibold text-slate-700">
                  Competência (Mês/Ano) *
                </Label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Select
                    value={competenciaMes ? competenciaMes.chave : undefined}
                    onValueChange={(val) => {
                      const mes = competencias.find((m) => m.chave === val)
                      if (mes) {
                        setData(`${mes.chave}-15`)
                      }
                    }}
                  >
                    <SelectTrigger
                      id="aj-var-data"
                      className="h-9 text-xs bg-white pl-8 font-semibold w-full"
                    >
                      <SelectValue placeholder="Selecione a competência" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {competencias.map((m) => (
                        <SelectItem key={m.chave} value={m.chave} className="text-xs">
                          {m.rotuloCompleto}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[10px] text-slate-400">
                  Lançamentos mantidos dentro do exercício {anoContexto} preservam a consistência
                  dos indicadores da simulação.
                </p>
              </div>

              {/* Conta do plano de contas */}
              <div className="space-y-1.5">
                <Label htmlFor="aj-var-conta" className="text-xs font-semibold text-slate-700">
                  Conta do Plano de Contas *
                </Label>
                <SeletorPlanoContaCombobox
                  id="aj-var-conta"
                  value={planoContaId}
                  onValueChange={(val) => setPlanoContaId(val)}
                  planoContas={planoContasEmpresa}
                  empresaAtivaId={empresaId}
                  placeholder="Buscar conta por código ou nome..."
                />
              </div>

              {/* Histórico */}
              <div className="space-y-1.5">
                <Label htmlFor="aj-var-hist" className="text-xs font-semibold text-slate-700">
                  Histórico / Observações
                </Label>
                <Textarea
                  id="aj-var-hist"
                  value={historico}
                  onChange={(e) => setHistorico(e.target.value)}
                  className="min-h-[64px] text-xs"
                  placeholder="Ex.: Ajuste manual da comissão do período"
                />
              </div>

              {/* Aviso de auditoria */}
              <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200/70 flex items-start gap-2">
                <History className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[10.5px] text-blue-900 leading-relaxed">
                  <strong>Toda alteração é auditada:</strong> a auditoria de lançamentos guarda o
                  valor anterior, o novo valor, a competência e o usuário responsável — o mesmo
                  mecanismo usado na tela de Lançamentos e na DRE Gerencial.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="text-xs h-9"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || !lancamento}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
            >
              {saving ? 'Gravando...' : 'Salvar Ajuste'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
