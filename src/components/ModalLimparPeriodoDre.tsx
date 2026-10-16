import { useState, useEffect } from 'react'
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
import { AlertTriangle, Trash2, Loader2, CheckCircle2 } from 'lucide-react'
import { lancamentosService } from '@/services/financeService'
import { useToast } from '@/hooks/use-toast'

interface ModalLimparPeriodoDreProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaId: string
  empresaNome: string
  anoInicialPadrao?: number
  onSucesso: () => void
}

function formatBrl(val: number): string {
  return (val || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function ModalLimparPeriodoDre({
  open,
  onOpenChange,
  empresaId,
  empresaNome,
  anoInicialPadrao,
  onSucesso,
}: ModalLimparPeriodoDreProps) {
  const { toast } = useToast()

  const defaultYear = anoInicialPadrao || new Date().getFullYear()

  const [dataInicio, setDataInicio] = useState(`${defaultYear}-01-01`)
  const [dataFim, setDataFim] = useState(`${defaultYear}-12-31`)
  const [confirmacaoTexto, setConfirmacaoTexto] = useState('')

  // Estados de contagem / pré-visualização
  const [carregandoContagem, setCarregandoContagem] = useState(false)
  const [contagem, setContagem] = useState<{
    total: number
    valorTotal: number
  } | null>(null)
  const [erroContagem, setErroContagem] = useState<string | null>(null)

  // Estado de execução da exclusão
  const [excluindo, setExcluindo] = useState(false)

  // Quando o modal abre ou o ano inicial muda, reseta os valores padrão
  useEffect(() => {
    if (open) {
      const ano = anoInicialPadrao || new Date().getFullYear()
      setDataInicio(`${ano}-01-01`)
      setDataFim(`${ano}-12-31`)
      setConfirmacaoTexto('')
      setErroContagem(null)
    }
  }, [open, anoInicialPadrao])

  // Busca contagem prévia sempre que data_inicio ou data_fim mudarem no modal aberto
  useEffect(() => {
    if (!open || !empresaId || !dataInicio || !dataFim) {
      return
    }

    if (dataInicio > dataFim) {
      setContagem(null)
      setErroContagem('A data inicial deve ser anterior ou igual à data final.')
      return
    }

    let isMounted = true
    const carregarPreview = async () => {
      try {
        setCarregandoContagem(true)
        setErroContagem(null)
        const res = await lancamentosService.limparPeriodo({
          empresa: empresaId,
          data_inicio: dataInicio,
          data_fim: dataFim,
          modo: 'contar',
        })
        if (isMounted) {
          setContagem({
            total: res.total ?? res.excluidos ?? 0,
            valorTotal: res.valor_total || 0,
          })
        }
      } catch (err: any) {
        if (isMounted) {
          setContagem(null)
          setErroContagem(err?.message || 'Falha ao consultar lançamentos do período.')
        }
      } finally {
        if (isMounted) {
          setCarregandoContagem(false)
        }
      }
    }

    const timer = setTimeout(() => {
      carregarPreview()
    }, 200)

    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [open, empresaId, dataInicio, dataFim])

  const confirmacaoValida = confirmacaoTexto.trim().toUpperCase() === 'LIMPAR'
  const podeExcluir =
    confirmacaoValida &&
    !excluindo &&
    !carregandoContagem &&
    contagem !== null &&
    contagem.total > 0

  const handleExecutarLimpeza = async () => {
    if (!podeExcluir) return

    try {
      setExcluindo(true)
      const res = await lancamentosService.limparPeriodo({
        empresa: empresaId,
        data_inicio: dataInicio,
        data_fim: dataFim,
        modo: 'executar',
      })

      toast({
        title: 'Período limpo com sucesso!',
        description: `${res.excluidos} lançamentos excluídos permanentemente (${formatBrl(
          res.valor_total,
        )}). Auditoria consolidada registrada.`,
      })

      onSucesso()
      onOpenChange(false)
    } catch (err: any) {
      console.error('Erro na limpeza de período:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao limpar período',
        description:
          err?.message || 'Não foi possível concluir a exclusão dos lançamentos. Tente novamente.',
      })
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white">
        <DialogHeader>
          <div className="flex items-center gap-2 text-rose-600">
            <span className="p-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-200">
              <Trash2 className="w-5 h-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Limpar Período de Lançamentos
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Exclusão definitiva de lançamentos para reimportação de dados.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Identificação da empresa */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-xs">
            <span className="text-slate-500">Empresa: </span>
            <span className="font-bold text-slate-800">{empresaNome}</span>
          </div>

          {/* Seleção do Intervalo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Data Inicial</Label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                disabled={excluindo}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Data Final</Label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                disabled={excluindo}
                className="h-8 text-xs mt-1"
              />
            </div>
          </div>

          {/* Atalhos rápidos de anos comuns */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-500 font-medium">Atalhos:</span>
            <button
              type="button"
              onClick={() => {
                setDataInicio('2024-01-01')
                setDataFim('2025-12-31')
              }}
              className="text-[11px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
            >
              2024 + 2025
            </button>
            <button
              type="button"
              onClick={() => {
                setDataInicio('2024-01-01')
                setDataFim('2024-12-31')
              }}
              className="text-[11px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
            >
              Ano 2024
            </button>
            <button
              type="button"
              onClick={() => {
                setDataInicio('2025-01-01')
                setDataFim('2025-12-31')
              }}
              className="text-[11px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
            >
              Ano 2025
            </button>
          </div>

          {/* Painel de Contagem / Pré-visualização */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-1">
            <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
              Pré-visualização do Impacto:
            </div>
            {carregandoContagem ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                <span>Consultando lançamentos no período...</span>
              </div>
            ) : erroContagem ? (
              <div className="text-xs text-rose-600 font-medium">{erroContagem}</div>
            ) : contagem ? (
              contagem.total === 0 ? (
                <div className="text-xs text-slate-500 py-1">
                  Nenhum lançamento encontrado neste período para esta empresa.
                </div>
              ) : (
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-sm font-bold text-slate-800">
                    {contagem.total} lançamentos
                  </span>
                  <span className="text-xs font-semibold text-rose-700">
                    Total: {formatBrl(contagem.valorTotal)}
                  </span>
                </div>
              )
            ) : null}
          </div>

          {/* Alerta de Ação Destrutiva */}
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 flex gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-rose-800 leading-relaxed">
              <span className="font-bold">Atenção: </span>
              Os lançamentos serão excluídos permanentemente. Os registros de auditoria são
              preservados na coleção de auditoria. Esta ação é irreversível.
            </div>
          </div>

          {/* Confirmação por Digitação */}
          {contagem && contagem.total > 0 && (
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs font-semibold text-slate-700">
                Digite <span className="font-bold text-rose-600">LIMPAR</span> para confirmar a
                exclusão:
              </Label>
              <Input
                type="text"
                value={confirmacaoTexto}
                onChange={(e) => setConfirmacaoTexto(e.target.value)}
                placeholder="LIMPAR"
                disabled={excluindo}
                className={`h-8 text-xs uppercase tracking-wider ${
                  confirmacaoValida ? 'border-rose-400 bg-rose-50/30' : ''
                }`}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={excluindo}
            className="h-8 text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleExecutarLimpeza}
            disabled={!podeExcluir}
            className="h-8 text-xs font-bold gap-1.5 bg-rose-600 hover:bg-rose-700"
          >
            {excluindo ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Excluindo...
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                Excluir Lançamentos
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
